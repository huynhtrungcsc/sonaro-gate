#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Sonaro Gate • 2025.1 LTS  —  One-Command Installer
# ─────────────────────────────────────────────────────────────────────────────
#
# Quick start (one command — choose Docker or Native interactively):
#   curl -fsSL https://raw.githubusercontent.com/huynhtrungcsc/sonaro-gate/main/deploy/install.sh | sudo bash
#
# Force Docker mode (no prompt):
#   curl -fsSL .../deploy/install.sh | sudo INSTALL_METHOD=docker bash
#
# Force Native mode (no prompt):
#   curl -fsSL .../deploy/install.sh | sudo INSTALL_METHOD=native bash
#
# Or clone the repo first and run locally:
#   git clone https://github.com/huynhtrungcsc/sonaro-gate.git
#   sudo bash sonaro-gate/deploy/install.sh
#
# Tested on: Ubuntu 24.04 LTS (Noble Numbat) — x86_64
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'

info()  { echo -e "${CYAN}[INFO]${RESET}  $*"; }
ok()    { echo -e "${GREEN}[  OK ]${RESET}  $*"; }
warn()  { echo -e "${YELLOW}[ WARN]${RESET}  $*"; }
step()  { echo -e "\n${BOLD}${CYAN}── $* ${RESET}"; }
die()   { echo -e "${RED}[ERROR]${RESET}  $*" >&2; exit 1; }

# ── Guards ────────────────────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || die "Must run as root: sudo bash $0"
[[ -f /etc/os-release ]] || die "Cannot detect OS"
# shellcheck source=/dev/null
source /etc/os-release
[[ "$ID" == "ubuntu" ]] || warn "Tested on Ubuntu — your OS: $PRETTY_NAME"
[[ "${VERSION_ID}" == "24.04" ]] || \
    warn "Optimised for Ubuntu 24.04 — your version: ${VERSION_ID}"

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}"
echo "  ╔════════════════════════════════════════════════════════════╗"
echo "  ║          SONARO GATE • 2025.1 LTS — Installer             ║"
echo "  ║       Next-Generation Firewall — Ubuntu 24.04 LTS         ║"
echo "  ╚════════════════════════════════════════════════════════════╝"
echo -e "${RESET}"

# ── Config ────────────────────────────────────────────────────────────────────
INSTALL_DIR="${INSTALL_DIR:-/opt/sonaro}"
REPO_URL="https://github.com/huynhtrungcsc/sonaro-gate.git"
PORT="${PORT:-5000}"
DB_NAME="${POSTGRES_DB:-sonaro_gate}"
DB_USER="${POSTGRES_USER:-sonaro}"
DB_PASS="${POSTGRES_PASSWORD:-$(openssl rand -hex 20)}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"

# ── Choose install method ─────────────────────────────────────────────────────
METHOD="${INSTALL_METHOD:-}"

if [[ -z "$METHOD" ]]; then
    # Only show prompt when running interactively (not piped)
    if [ -t 0 ]; then
        echo -e "  ${BOLD}Choose install method:${RESET}"
        echo ""
        echo -e "  ${BOLD}[1] Docker${RESET}  ${GREEN}(recommended)${RESET}"
        echo -e "      • Installs Docker Engine + starts containers"
        echo -e "      • Faster setup — no need to install Node.js or PostgreSQL manually"
        echo -e "      • Easy to update: docker compose pull && docker compose up -d"
        echo -e "      • PostgreSQL data persisted in /opt/sonaro/data/postgres"
        echo ""
        echo -e "  ${BOLD}[2] Native${RESET}"
        echo -e "      • Installs Node.js 20 + PostgreSQL + Suricata directly on Ubuntu"
        echo -e "      • Full direct kernel access (iptables, netplan, sysctl)"
        echo -e "      • Runs as a systemd service: sonaro-gate.service"
        echo ""
        read -rp "  Choice [1]: " METHOD_INPUT
        METHOD_INPUT="${METHOD_INPUT:-1}"
        case "$METHOD_INPUT" in
            2|native|Native|NATIVE) METHOD="native" ;;
            *)                      METHOD="docker" ;;
        esac
    else
        # Non-interactive (curl | bash): default to Docker
        METHOD="docker"
        info "Non-interactive mode — defaulting to Docker install"
        info "  To use native: sudo INSTALL_METHOD=native bash <(curl -fsSL ...)"
    fi
fi

echo ""
info "Install method: ${BOLD}${METHOD}${RESET}"
info "Install dir:    ${INSTALL_DIR}"
info "Port:           ${PORT}"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# DOCKER INSTALL PATH
# ─────────────────────────────────────────────────────────────────────────────
install_docker_mode() {

    # ── Step 1: Install Docker Engine ─────────────────────────────────────────
    step "Step 1/5 — Docker Engine"

    if command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
        ok "Docker $(docker --version | awk '{print $3}' | tr -d ',') already installed"
    else
        info "Installing Docker Engine..."
        export DEBIAN_FRONTEND=noninteractive
        apt-get update -qq
        apt-get install -y -qq ca-certificates curl gnupg lsb-release

        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
            | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        chmod a+r /etc/apt/keyrings/docker.gpg

        echo \
            "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
            https://download.docker.com/linux/ubuntu \
            $(lsb_release -cs) stable" \
            > /etc/apt/sources.list.d/docker.list

        apt-get update -qq
        apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
            docker-buildx-plugin docker-compose-plugin

        systemctl enable --now docker
        ok "Docker $(docker --version | awk '{print $3}' | tr -d ',') installed"
    fi

    # ── Step 2: Download Sonaro Gate ──────────────────────────────────────────
    step "Step 2/5 — Download source"

    apt-get install -y -qq git 2>/dev/null || true

    if [[ -d "${INSTALL_DIR}/.git" ]]; then
        info "Updating existing repo at ${INSTALL_DIR}..."
        git -C "$INSTALL_DIR" pull --ff-only
    elif [[ -d "${INSTALL_DIR}/src" ]]; then
        info "Source already present at ${INSTALL_DIR} (not a git repo — skipping pull)"
    else
        info "Cloning from ${REPO_URL}..."
        git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
    fi
    ok "Source ready at ${INSTALL_DIR}"

    # ── Step 3: Write environment file ───────────────────────────────────────
    step "Step 3/5 — Environment"

    mkdir -p "${INSTALL_DIR}"
    cat > "${INSTALL_DIR}/.env" <<ENV
# Sonaro Gate — Environment Configuration
# Generated by install.sh (Docker mode) on $(date -u +"%Y-%m-%dT%H:%M:%SZ")

NODE_ENV=production
PORT=${PORT}

# PostgreSQL
POSTGRES_DB=${DB_NAME}
POSTGRES_USER=${DB_USER}
POSTGRES_PASSWORD=${DB_PASS}

# App
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}
JWT_SECRET=${JWT_SECRET}

# Set to 1 to skip the CLI setup wizard (configure via web UI instead)
SONARO_SKIP_SETUP=
ENV

    chmod 600 "${INSTALL_DIR}/.env"
    ok ".env written (chmod 600)"

    # ── Step 4: Build and start containers ────────────────────────────────────
    step "Step 4/5 — Build & start containers"

    cd "$INSTALL_DIR"

    COMPOSE_FILE="docker/docker-compose.quickstart.yml"

    info "Building Docker image (first run takes 3–5 min)..."
    docker compose -f "$COMPOSE_FILE" --env-file .env build --quiet

    info "Starting containers..."
    docker compose -f "$COMPOSE_FILE" --env-file .env up -d

    ok "Containers started"

    # ── Step 5: Wait for health check ─────────────────────────────────────────
    step "Step 5/5 — Health check"

    info "Waiting for Sonaro Gate to be ready (up to 3 min)..."
    MAX=36   # 36 × 5s = 3 min
    for ((i=1; i<=MAX; i++)); do
        if curl -sf "http://127.0.0.1:${PORT}/api/health" &>/dev/null; then
            ok "Health check passed after $((i*5))s"
            break
        fi
        if [[ $i -eq $MAX ]]; then
            warn "Health check timed out — check logs with:"
            warn "  docker compose -f ${INSTALL_DIR}/${COMPOSE_FILE} logs -f"
        fi
        sleep 5
        printf "  Waiting... (%ds)\r" $((i*5))
    done

    # ── Print summary ─────────────────────────────────────────────────────────
    LAN_IP=$(ip route get 1 2>/dev/null | grep -oP 'src \K\S+' | head -1 || echo "<LAN_IP>")

    echo ""
    echo -e "${BOLD}${GREEN}"
    echo "  ╔════════════════════════════════════════════════════════════╗"
    echo "  ║               DOCKER INSTALL COMPLETE                     ║"
    echo "  ╚════════════════════════════════════════════════════════════╝"
    echo -e "${RESET}"
    echo -e "  ${BOLD}Web UI:${RESET}   http://${LAN_IP}:${PORT}"
    echo -e "  ${BOLD}Login:${RESET}    admin@sonaro.local / Admin123!  ${DIM}(change on first login)${RESET}"
    echo ""
    echo -e "  ${BOLD}Next step — configure WAN/LAN interfaces:${RESET}"
    echo -e "  ${DIM}The CLI wizard assigns network cards to WAN, LAN, DMZ before first login.${RESET}"
    echo -e "  Run:"
    echo -e "    ${CYAN}docker compose -f ${INSTALL_DIR}/${COMPOSE_FILE} stop sonaro-gate${RESET}"
    echo -e "    ${CYAN}docker exec -it sonaro-gate npx tsx /opt/sonaro/server/index.ts${RESET}"
    echo ""
    echo -e "  ${BOLD}Container management:${RESET}"
    echo -e "    Logs:    ${CYAN}docker compose -f ${INSTALL_DIR}/${COMPOSE_FILE} logs -f${RESET}"
    echo -e "    Restart: ${CYAN}docker compose -f ${INSTALL_DIR}/${COMPOSE_FILE} restart${RESET}"
    echo -e "    Stop:    ${CYAN}docker compose -f ${INSTALL_DIR}/${COMPOSE_FILE} down${RESET}"
    echo -e "    Update:  ${CYAN}git -C ${INSTALL_DIR} pull && docker compose -f ${INSTALL_DIR}/${COMPOSE_FILE} up -d --build${RESET}"
    echo ""
    echo -e "  Data: ${INSTALL_DIR}/data/postgres  ${DIM}(PostgreSQL volumes)${RESET}"
    echo -e "  Env:  ${INSTALL_DIR}/.env           ${DIM}(DB password + JWT secret)${RESET}"
    echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# NATIVE INSTALL PATH
# ─────────────────────────────────────────────────────────────────────────────
install_native_mode() {

    # ── Step 1: System packages ───────────────────────────────────────────────
    step "Step 1/7 — System packages"
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq \
        curl wget gnupg ca-certificates lsb-release \
        iptables iptables-persistent \
        iproute2 ipset \
        netplan.io \
        postgresql postgresql-client \
        git build-essential \
        suricata suricata-update \
        wireguard wireguard-tools \
        openvpn easy-rsa \
        dnsmasq \
        openssl jq
    ok "System packages installed"

    # ── Step 2: Node.js 20 ────────────────────────────────────────────────────
    step "Step 2/7 — Node.js 20"
    if ! command -v node &>/dev/null || [[ "$(node -v 2>/dev/null)" != v20* ]]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
        apt-get install -y -qq nodejs
    fi
    ok "Node.js $(node -v)"

    # ── Step 3: Clone / update application ───────────────────────────────────
    step "Step 3/7 — Application source"

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo "")"
    APP_SRC=""

    # If running from a cloned repo, use the parent directory
    if [[ -n "$SCRIPT_DIR" && -f "${SCRIPT_DIR}/../package.json" ]]; then
        APP_SRC="$(realpath "${SCRIPT_DIR}/..")"
        info "Using local source at: ${APP_SRC}"
    fi

    if [[ -d "${INSTALL_DIR}/.git" ]]; then
        info "Updating existing install at ${INSTALL_DIR}..."
        git -C "$INSTALL_DIR" pull --ff-only
    elif [[ -n "$APP_SRC" ]]; then
        info "Copying from ${APP_SRC} to ${INSTALL_DIR}..."
        mkdir -p "$INSTALL_DIR"
        rsync -a --exclude='.git' --exclude='node_modules' --exclude='dist' \
              --exclude='.env' "${APP_SRC}/" "${INSTALL_DIR}/"
    else
        info "Cloning from ${REPO_URL}..."
        git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
    fi

    cd "$INSTALL_DIR"
    npm ci --omit=dev --silent
    npm run build
    ok "Application built at ${INSTALL_DIR}"

    # ── Step 4: Enable IP forwarding ─────────────────────────────────────────
    step "Step 4/7 — Kernel network settings"
    sysctl -w net.ipv4.ip_forward=1 >/dev/null
    {
        echo "net.ipv4.ip_forward=1"
        echo "net.ipv6.conf.all.forwarding=1"
        echo "net.ipv4.conf.all.rp_filter=0"
    } > /etc/sysctl.d/99-sonaro.conf
    sysctl -p /etc/sysctl.d/99-sonaro.conf >/dev/null
    ok "IP forwarding enabled"

    # ── Step 5: PostgreSQL ────────────────────────────────────────────────────
    step "Step 5/7 — PostgreSQL database"
    systemctl enable --now postgresql

    sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" 2>/dev/null \
        || sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" 2>/dev/null || true
    ok "Database ${DB_NAME} ready"

    # ── Step 6: Environment file + migrations ─────────────────────────────────
    step "Step 6/7 — Configuration"
    DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"

    cat > "${INSTALL_DIR}/.env" <<ENV
# Sonaro Gate — Environment Configuration
# Generated by install.sh (native mode) on $(date -u +"%Y-%m-%dT%H:%M:%SZ")

NODE_ENV=production
PORT=${PORT}
DATABASE_URL=${DATABASE_URL}
JWT_SECRET=${JWT_SECRET}
SONARO_SKIP_SETUP=
ENV

    chmod 600 "${INSTALL_DIR}/.env"

    cd "$INSTALL_DIR"
    DATABASE_URL="$DATABASE_URL" npx drizzle-kit push --force 2>/dev/null
    DATABASE_URL="$DATABASE_URL" npx tsx server/seed.ts
    ok "Schema migrations and seed data applied"

    # ── Step 7: Suricata IPS ──────────────────────────────────────────────────
    step "Step 6b/7 — Suricata IPS"
    mkdir -p /etc/suricata/rules
    touch /etc/suricata/rules/sonaro-local.rules
    suricata-update --no-reload 2>/dev/null || warn "suricata-update failed (no internet?)"
    systemctl enable --now suricata 2>/dev/null || true
    ok "Suricata IPS ready"

    # ── Step 7: Systemd service ───────────────────────────────────────────────
    step "Step 7/7 — Systemd service"
    cp "${INSTALL_DIR}/deploy/sonaro-gate.service" /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable sonaro-gate
    systemctl start sonaro-gate
    ok "sonaro-gate.service started"

    # ── Print summary ─────────────────────────────────────────────────────────
    LAN_IP=$(ip route get 1 2>/dev/null | grep -oP 'src \K\S+' | head -1 || echo "<LAN_IP>")

    echo ""
    echo -e "${BOLD}${GREEN}"
    echo "  ╔════════════════════════════════════════════════════════════╗"
    echo "  ║               NATIVE INSTALL COMPLETE                     ║"
    echo "  ╚════════════════════════════════════════════════════════════╝"
    echo -e "${RESET}"
    echo -e "  ${BOLD}Web UI:${RESET}   http://${LAN_IP}:${PORT}"
    echo -e "  ${BOLD}Login:${RESET}    admin@sonaro.local / Admin123!  ${DIM}(change on first login)${RESET}"
    echo ""
    echo -e "  ${BOLD}Next step — configure WAN/LAN/DMZ interfaces (required):${RESET}"
    echo -e "  ${DIM}Run the CLI wizard to assign network cards before opening the web UI.${RESET}"
    echo -e "    ${CYAN}sudo systemctl stop sonaro-gate${RESET}"
    echo -e "    ${CYAN}sudo bash -c 'cd ${INSTALL_DIR} && npx tsx server/index.ts'${RESET}"
    echo -e "  ${DIM}See: https://github.com/huynhtrungcsc/sonaro-gate/blob/main/docs/CLI-NETWORK-SETUP.md${RESET}"
    echo ""
    echo -e "  ${BOLD}Service management:${RESET}"
    echo -e "    Status:  ${CYAN}systemctl status sonaro-gate${RESET}"
    echo -e "    Logs:    ${CYAN}journalctl -u sonaro-gate -f${RESET}"
    echo -e "    Restart: ${CYAN}systemctl restart sonaro-gate${RESET}"
    echo ""
    echo -e "  Env: ${INSTALL_DIR}/.env  ${DIM}(DB URL + JWT secret)${RESET}"
    echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Run
# ─────────────────────────────────────────────────────────────────────────────
case "$METHOD" in
    docker|Docker|DOCKER|1)
        install_docker_mode
        ;;
    native|Native|NATIVE|2)
        install_native_mode
        ;;
    *)
        die "Unknown install method: '${METHOD}'. Use 'docker' or 'native'."
        ;;
esac
