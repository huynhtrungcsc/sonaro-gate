#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Sonaro Gate • 2025.1 LTS  —  One-Command Installer
# ─────────────────────────────────────────────────────────────────────────────
#
# Quick start:
#   curl -fsSL https://raw.githubusercontent.com/huynhtrungcsc/sonaro-gate/main/deploy/install.sh | sudo bash
#
# Force Docker mode (no prompt):
#   curl -fsSL .../deploy/install.sh | sudo INSTALL_METHOD=docker bash
#
# Force Native mode (no prompt):
#   curl -fsSL .../deploy/install.sh | sudo INSTALL_METHOD=native bash
#
# Tested on: Ubuntu 24.04 LTS (Noble Numbat) — x86_64
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Colour helpers ─────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'

info()  { echo -e "${CYAN}[INFO]${RESET}  $*"; }
ok()    { echo -e "${GREEN}[  OK ]${RESET}  $*"; }
warn()  { echo -e "${YELLOW}[ WARN]${RESET}  $*"; }
step()  { echo -e "\n${BOLD}${CYAN}── $* ${RESET}"; }
die()   { echo -e "${RED}[ERROR]${RESET}  $*" >&2; exit 1; }
chk()   { printf "    %-22s %s\n" "$1:" "$2"; }

# ── Root guard ────────────────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || die "Must run as root.  Try: sudo bash $0"
[[ -f /etc/os-release ]] || die "Cannot detect OS — /etc/os-release missing"
# shellcheck source=/dev/null
source /etc/os-release

# ── Banner ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}"
echo "  ╔════════════════════════════════════════════════════════════╗"
echo "  ║          SONARO GATE • 2025.1 LTS — Installer             ║"
echo "  ║       Next-Generation Firewall — Ubuntu 24.04 LTS         ║"
echo "  ╚════════════════════════════════════════════════════════════╝"
echo -e "${RESET}"

# ── Config ─────────────────────────────────────────────────────────────────────
INSTALL_DIR="${INSTALL_DIR:-/opt/sonaro}"
REPO_URL="https://github.com/huynhtrungcsc/sonaro-gate.git"
PORT="${PORT:-5000}"
DB_NAME="${POSTGRES_DB:-sonaro_gate}"
DB_USER="${POSTGRES_USER:-sonaro}"
DB_PASS="${POSTGRES_PASSWORD:-$(openssl rand -hex 20)}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
COMPOSE_FILE="${INSTALL_DIR}/deploy/docker-compose.prod.yml"

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 1 — SYSTEM CHECK
# ─────────────────────────────────────────────────────────────────────────────
system_check() {
    step "Phase 1 — System check"

    # OS compatibility
    if [[ "$ID" == "ubuntu" && "${VERSION_ID}" == "24.04" ]]; then
        ok "OS: ${PRETTY_NAME} ✓ (fully supported)"
    elif [[ "$ID" == "ubuntu" ]]; then
        warn "OS: ${PRETTY_NAME} — optimised for Ubuntu 24.04 LTS, continuing anyway"
    else
        warn "OS: ${PRETTY_NAME} — untested (Ubuntu 24.04 LTS recommended)"
    fi

    # Hardware
    CPU_CORES=$(nproc 2>/dev/null || echo "?")
    RAM_TOTAL=$(free -h 2>/dev/null | awk '/^Mem:/{print $2}' || echo "?")
    DISK_FREE=$(df -h "${INSTALL_DIR%/*}" 2>/dev/null | awk 'NR==2{print $4}' || df -h / | awk 'NR==2{print $4}')

    echo ""
    echo -e "  ${BOLD}Hardware${RESET}"
    chk "CPU" "${CPU_CORES} core(s)"
    chk "RAM" "${RAM_TOTAL}"
    chk "Disk free" "${DISK_FREE} (at ${INSTALL_DIR%/*})"

    [[ "${CPU_CORES}" -ge 2 ]] 2>/dev/null || warn "Minimum 2 CPU cores recommended (detected: ${CPU_CORES})"

    # Network interfaces
    NIC_COUNT=$(ip -o link show 2>/dev/null | grep -v 'lo' | wc -l || echo "0")
    echo ""
    echo -e "  ${BOLD}Network interfaces${RESET}"
    ip -o link show 2>/dev/null | grep -v '^[0-9]*: lo' | while IFS= read -r line; do
        IFACE=$(echo "$line" | awk -F': ' '{print $2}')
        STATE=$(echo "$line" | grep -oP '(?<=state )\S+' || echo "UNKNOWN")
        printf "    %-18s %s\n" "$IFACE" "$STATE"
    done
    [[ "${NIC_COUNT}" -lt 2 ]] && warn "Firewall requires at least 2 NICs (WAN + LAN). Found: ${NIC_COUNT}"

    # Internet connectivity
    echo ""
    echo -e "  ${BOLD}Connectivity${RESET}"
    if curl -s --connect-timeout 8 https://github.com > /dev/null 2>&1; then
        chk "github.com" "${GREEN}reachable${RESET}"
    else
        warn "Cannot reach github.com — install may fail (check internet/DNS)"
    fi
    if curl -s --connect-timeout 8 https://registry-1.docker.io > /dev/null 2>&1; then
        chk "docker hub" "${GREEN}reachable${RESET}"
    else
        warn "Cannot reach Docker Hub — image pulls may fail"
    fi

    # What is already installed
    echo ""
    echo -e "  ${BOLD}Pre-installed software${RESET}"
    for tool in docker git curl openssl node npm psql suricata wireguard; do
        if command -v "$tool" &>/dev/null; then
            VER=$("$tool" --version 2>/dev/null | head -1 | sed 's/^[^0-9]*//' | cut -c1-30 || echo "installed")
            printf "    ${GREEN}✓${RESET} %-18s ${DIM}%s${RESET}\n" "$tool" "$VER"
        else
            printf "    ${DIM}✗ %-18s not installed${RESET}\n" "$tool"
        fi
    done

    echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 2 — DETECT AND CLEAN PREVIOUS INSTALL
# ─────────────────────────────────────────────────────────────────────────────
detect_and_clean() {
    local found_docker=0 found_dir=0 found_service=0

    # Detect existing Docker containers
    if command -v docker &>/dev/null 2>&1; then
        if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qE '^(sonaro-gate|sonaro-db)$'; then
            found_docker=1
        fi
    fi

    # Detect existing installation directory
    if [[ -d "${INSTALL_DIR}" ]]; then
        found_dir=1
    fi

    # Detect existing systemd service
    if [[ -f /etc/systemd/system/sonaro-gate.service ]]; then
        found_service=1
    fi

    local found_any=$(( found_docker + found_dir + found_service ))
    [[ "$found_any" -eq 0 ]] && return 0   # Nothing found — continue fresh

    step "Phase 2 — Previous installation detected"

    [[ "$found_docker"  -eq 1 ]] && warn "Found Sonaro Gate Docker containers (sonaro-gate / sonaro-db)"
    [[ "$found_dir"     -eq 1 ]] && warn "Found existing install directory: ${INSTALL_DIR}"
    [[ "$found_service" -eq 1 ]] && warn "Found existing systemd service: sonaro-gate.service"

    echo ""
    echo -e "  ${BOLD}The installer will perform a complete clean wipe:${RESET}"
    echo -e "  ${DIM}• Stop running containers / systemd service${RESET}"
    echo -e "  ${DIM}• Remove Docker containers, images, and volumes${RESET}"
    echo -e "  ${DIM}• Remove installation directory: ${INSTALL_DIR}${RESET}"
    echo -e "  ${DIM}• Remove systemd unit file${RESET}"
    echo -e "  ${YELLOW}⚠  All firewall configuration data will be erased (fresh start)${RESET}"
    echo ""

    if [[ -t 0 ]]; then
        read -rp "  Continue with clean reinstall? [Y/n]: " _CONFIRM
        _CONFIRM="${_CONFIRM:-Y}"
        [[ "${_CONFIRM,,}" =~ ^(y|yes)$ ]] || die "Aborted — no changes made"
    else
        info "Non-interactive mode — proceeding with clean wipe automatically"
        info "(To cancel: Ctrl+C within 5 seconds)"
        sleep 5
    fi

    _do_cleanup
}

_do_cleanup() {
    step "Cleaning up previous installation"

    # 1. Stop Docker containers via compose file (preferred — also removes volumes)
    if command -v docker &>/dev/null && [[ -f "$COMPOSE_FILE" ]]; then
        info "Stopping containers via compose file..."
        docker compose -f "$COMPOSE_FILE" down -v --remove-orphans 2>/dev/null || true
    fi

    # 2. Remove containers by name (fallback if compose file missing)
    for cname in sonaro-gate sonaro-db; do
        if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx "$cname"; then
            info "Removing container: ${cname}"
            docker rm -f "$cname" 2>/dev/null || true
        fi
    done

    # 3. Remove Docker volumes
    for vol in sonaro_pgdata pgdata; do
        docker volume rm "$vol" 2>/dev/null || true
    done

    # 4. Remove the Docker image to force a full rebuild next time
    docker rmi sonaro-gate:latest 2>/dev/null || true

    # 5. Stop and disable systemd service (native mode)
    if systemctl is-active --quiet sonaro-gate 2>/dev/null; then
        info "Stopping sonaro-gate.service..."
        systemctl stop sonaro-gate 2>/dev/null || true
    fi
    if systemctl is-enabled --quiet sonaro-gate 2>/dev/null; then
        systemctl disable sonaro-gate 2>/dev/null || true
    fi
    if [[ -f /etc/systemd/system/sonaro-gate.service ]]; then
        rm -f /etc/systemd/system/sonaro-gate.service
        systemctl daemon-reload
    fi

    # 6. Remove sysctl config written by previous native install
    rm -f /etc/sysctl.d/99-sonaro.conf

    # 7. Remove installation directory (contains source + .env)
    if [[ -d "${INSTALL_DIR}" ]]; then
        info "Removing ${INSTALL_DIR}..."
        rm -rf "${INSTALL_DIR}"
    fi

    ok "Clean wipe complete — ready for fresh install"
    echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 3 — CHOOSE INSTALL METHOD
# ─────────────────────────────────────────────────────────────────────────────
METHOD="${INSTALL_METHOD:-}"

if [[ -z "$METHOD" ]]; then
    if [[ -t 0 ]]; then
        echo -e "  ${BOLD}Choose install method:${RESET}"
        echo ""
        echo -e "  ${BOLD}[1] Docker${RESET}  ${GREEN}(recommended)${RESET}"
        echo -e "      • Installs Docker Engine + starts containers"
        echo -e "      • No need to install Node.js or PostgreSQL manually"
        echo -e "      • Easy to update: git pull && docker compose up -d --build"
        echo -e "      • PostgreSQL data in named Docker volume (survives container restarts)"
        echo ""
        echo -e "  ${BOLD}[2] Native${RESET}"
        echo -e "      • Installs Node.js 20 + PostgreSQL + Suricata directly on Ubuntu"
        echo -e "      • Full direct kernel access (iptables, netplan, sysctl)"
        echo -e "      • Runs as a systemd service: sonaro-gate.service"
        echo ""
        read -rp "  Choice [1]: " _METHOD_INPUT
        _METHOD_INPUT="${_METHOD_INPUT:-1}"
        case "$_METHOD_INPUT" in
            2|native|Native|NATIVE) METHOD="native" ;;
            *)                      METHOD="docker" ;;
        esac
    else
        METHOD="docker"
        info "Non-interactive mode — defaulting to Docker install"
        info "  To use native: sudo INSTALL_METHOD=native bash <(curl -fsSL ...)"
    fi
fi

echo ""
info "Install method : ${BOLD}${METHOD}${RESET}"
info "Install dir    : ${INSTALL_DIR}"
info "Port           : ${PORT}"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# RUN PHASE 1 and 2 NOW (after method is known)
# ─────────────────────────────────────────────────────────────────────────────
system_check
detect_and_clean

# ─────────────────────────────────────────────────────────────────────────────
# DOCKER INSTALL
# ─────────────────────────────────────────────────────────────────────────────
install_docker_mode() {

    # ── Step 1: Docker Engine ─────────────────────────────────────────────────
    step "Step 1/5 — Docker Engine"

    if command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
        ok "Docker $(docker --version | awk '{print $3}' | tr -d ',') already installed — skipping"
    else
        info "Installing Docker Engine from official Docker repository..."
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

    # ── Step 2: Clone source ──────────────────────────────────────────────────
    step "Step 2/5 — Download source"

    apt-get install -y -qq git 2>/dev/null || true

    info "Cloning from ${REPO_URL}..."
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
    ok "Source ready at ${INSTALL_DIR}"

    # ── Step 3: Write .env ────────────────────────────────────────────────────
    step "Step 3/5 — Environment configuration"

    cat > "${INSTALL_DIR}/.env" <<ENV
# Sonaro Gate — Environment Configuration
# Generated by install.sh (Docker mode) on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# !! Keep this file private — it contains database credentials and JWT secret !!

NODE_ENV=production
PORT=${PORT}

# PostgreSQL credentials
POSTGRES_DB=${DB_NAME}
POSTGRES_USER=${DB_USER}
POSTGRES_PASSWORD=${DB_PASS}

# App connection string (must match the PostgreSQL credentials above)
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}

# JWT secret — used to sign session tokens (never share this value)
JWT_SECRET=${JWT_SECRET}

# Set to 1 to skip the CLI wizard and go straight to the web UI
SONARO_SKIP_SETUP=
ENV

    chmod 600 "${INSTALL_DIR}/.env"
    ok ".env written and protected (chmod 600)"

    # ── Step 4: Build and start ────────────────────────────────────────────────
    step "Step 4/5 — Build Docker image and start containers"

    cd "$INSTALL_DIR"

    info "Building Docker image — this compiles the TypeScript frontend and backend."
    info "First run takes 3–5 minutes depending on internet speed..."
    docker compose -f deploy/docker-compose.prod.yml --env-file .env build

    info "Starting containers (PostgreSQL + Sonaro Gate)..."
    docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d
    ok "Containers started"

    # ── Step 5: Health check ───────────────────────────────────────────────────
    step "Step 5/5 — Waiting for application to be ready"

    info "Polling /api/health (up to 3 minutes)..."
    MAX=36   # 36 × 5s = 3 min
    for (( i=1; i<=MAX; i++ )); do
        if curl -sf "http://127.0.0.1:${PORT}/api/health" &>/dev/null; then
            ok "Application is healthy (after $((i*5))s)"
            break
        fi
        [[ $i -eq $MAX ]] && warn "Health check timed out — run: docker compose -f ${INSTALL_DIR}/deploy/docker-compose.prod.yml logs -f"
        sleep 5
        printf "  Waiting... %ds elapsed\r" $((i*5))
    done

    # ── Summary ────────────────────────────────────────────────────────────────
    LAN_IP=$(ip route get 1 2>/dev/null | grep -oP 'src \K\S+' | head -1 || echo "<YOUR_SERVER_IP>")

    echo ""
    echo -e "${BOLD}${GREEN}"
    echo "  ╔════════════════════════════════════════════════════════════╗"
    echo "  ║              DOCKER INSTALL COMPLETE ✓                    ║"
    echo "  ╚════════════════════════════════════════════════════════════╝"
    echo -e "${RESET}"
    echo -e "  ${BOLD}Web UI:${RESET}   http://${LAN_IP}:${PORT}"
    echo -e "  ${BOLD}Login:${RESET}    admin@sonaro.local / Admin123!"
    echo -e "  ${DIM}          → Change the password immediately after first login${RESET}"
    echo ""
    echo -e "  ${BOLD}Next step — configure WAN/LAN/DMZ network interfaces:${RESET}"
    echo -e "  ${DIM}Before logging in from another device, assign your network cards.${RESET}"
    echo -e "  ${DIM}See: https://github.com/huynhtrungcsc/sonaro-gate/blob/main/docs/CLI-NETWORK-SETUP.md${RESET}"
    echo ""
    echo -e "  ${BOLD}Container management:${RESET}"
    echo -e "    Logs:    ${CYAN}docker compose -f ${INSTALL_DIR}/deploy/docker-compose.prod.yml logs -f${RESET}"
    echo -e "    Restart: ${CYAN}docker compose -f ${INSTALL_DIR}/deploy/docker-compose.prod.yml restart${RESET}"
    echo -e "    Stop:    ${CYAN}docker compose -f ${INSTALL_DIR}/deploy/docker-compose.prod.yml down${RESET}"
    echo -e "    Update:  ${CYAN}git -C ${INSTALL_DIR} pull && docker compose -f ${INSTALL_DIR}/deploy/docker-compose.prod.yml up -d --build${RESET}"
    echo ""
    echo -e "  ${BOLD}Files:${RESET}"
    echo -e "    Config:  ${INSTALL_DIR}/.env  ${DIM}(passwords — keep private)${RESET}"
    echo -e "    Data:    Docker volume ${DIM}pgdata${RESET}  ${DIM}(all firewall rules + settings)${RESET}"
    echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# NATIVE INSTALL
# ─────────────────────────────────────────────────────────────────────────────
install_native_mode() {

    export DEBIAN_FRONTEND=noninteractive

    # ── Step 1: System packages ────────────────────────────────────────────────
    step "Step 1/7 — Installing system packages"

    info "Updating package list..."
    apt-get update -qq

    info "Installing network tools, build tools, and system dependencies..."
    apt-get install -y -qq \
        curl wget gnupg ca-certificates lsb-release \
        iptables iptables-persistent netfilter-persistent \
        iproute2 ipset \
        netplan.io \
        postgresql postgresql-client \
        git build-essential \
        suricata suricata-update \
        wireguard wireguard-tools \
        dnsmasq \
        openssl jq
    ok "System packages installed"

    # ── Step 2: Node.js 20 ─────────────────────────────────────────────────────
    step "Step 2/7 — Node.js 20"

    if command -v node &>/dev/null && [[ "$(node -v 2>/dev/null)" == v20* ]]; then
        ok "Node.js $(node -v) already installed — skipping"
    else
        info "Installing Node.js 20 from NodeSource..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
        apt-get install -y -qq nodejs
        ok "Node.js $(node -v) installed"
    fi

    # ── Step 3: Clone source ───────────────────────────────────────────────────
    step "Step 3/7 — Download source"

    info "Cloning from ${REPO_URL}..."
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"

    cd "$INSTALL_DIR"
    info "Installing npm dependencies..."
    npm ci --omit=dev --silent
    info "Building frontend (Vite)..."
    npm run build
    ok "Application built at ${INSTALL_DIR}"

    # ── Step 4: Kernel settings ────────────────────────────────────────────────
    step "Step 4/7 — Kernel network settings"

    info "Enabling IP forwarding (required for NAT and routing)..."
    sysctl -w net.ipv4.ip_forward=1 >/dev/null
    {
        echo "net.ipv4.ip_forward=1"
        echo "net.ipv6.conf.all.forwarding=1"
        echo "net.ipv4.conf.all.rp_filter=0"
    } > /etc/sysctl.d/99-sonaro.conf
    sysctl -p /etc/sysctl.d/99-sonaro.conf >/dev/null
    ok "IP forwarding enabled and persisted"

    # ── Step 5: PostgreSQL ─────────────────────────────────────────────────────
    step "Step 5/7 — PostgreSQL database"

    systemctl enable --now postgresql
    sleep 2   # Give PostgreSQL a moment to become ready

    sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" 2>/dev/null \
        || sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" 2>/dev/null || true
    ok "Database ${DB_NAME} ready with user ${DB_USER}"

    # ── Step 6: Config + migrations ───────────────────────────────────────────
    step "Step 6/7 — Configuration and database schema"

    DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"

    cat > "${INSTALL_DIR}/.env" <<ENV
# Sonaro Gate — Environment Configuration
# Generated by install.sh (native mode) on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# !! Keep this file private — it contains database credentials and JWT secret !!

NODE_ENV=production
PORT=${PORT}
DATABASE_URL=${DATABASE_URL}
JWT_SECRET=${JWT_SECRET}
SONARO_SKIP_SETUP=
ENV

    chmod 600 "${INSTALL_DIR}/.env"

    cd "$INSTALL_DIR"
    info "Running database migrations (creating tables)..."
    DATABASE_URL="$DATABASE_URL" npx drizzle-kit push --force 2>/dev/null
    info "Seeding initial data (admin user + system defaults)..."
    DATABASE_URL="$DATABASE_URL" npx tsx server/seed.ts
    ok "Schema and seed data applied"

    # ── Step 6b: Suricata IPS ─────────────────────────────────────────────────
    info "Configuring Suricata IPS..."
    mkdir -p /etc/suricata/rules
    touch /etc/suricata/rules/sonaro-local.rules
    suricata-update --no-reload 2>/dev/null || warn "suricata-update failed (no internet?)"
    systemctl enable --now suricata 2>/dev/null || true
    ok "Suricata IPS ready"

    # ── Step 7: Systemd service ────────────────────────────────────────────────
    step "Step 7/7 — Systemd service"

    cp "${INSTALL_DIR}/deploy/sonaro-gate.service" /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable sonaro-gate
    systemctl start sonaro-gate
    ok "sonaro-gate.service started and enabled on boot"

    # ── Summary ────────────────────────────────────────────────────────────────
    LAN_IP=$(ip route get 1 2>/dev/null | grep -oP 'src \K\S+' | head -1 || echo "<YOUR_SERVER_IP>")

    echo ""
    echo -e "${BOLD}${GREEN}"
    echo "  ╔════════════════════════════════════════════════════════════╗"
    echo "  ║              NATIVE INSTALL COMPLETE ✓                    ║"
    echo "  ╚════════════════════════════════════════════════════════════╝"
    echo -e "${RESET}"
    echo -e "  ${BOLD}Web UI:${RESET}   http://${LAN_IP}:${PORT}"
    echo -e "  ${BOLD}Login:${RESET}    admin@sonaro.local / Admin123!"
    echo -e "  ${DIM}          → Change the password immediately after first login${RESET}"
    echo ""
    echo -e "  ${BOLD}Next step — configure WAN/LAN/DMZ network interfaces:${RESET}"
    echo -e "  ${DIM}See: https://github.com/huynhtrungcsc/sonaro-gate/blob/main/docs/CLI-NETWORK-SETUP.md${RESET}"
    echo ""
    echo -e "  ${BOLD}Service management:${RESET}"
    echo -e "    Status:  ${CYAN}systemctl status sonaro-gate${RESET}"
    echo -e "    Logs:    ${CYAN}journalctl -u sonaro-gate -f${RESET}"
    echo -e "    Restart: ${CYAN}systemctl restart sonaro-gate${RESET}"
    echo -e "    Stop:    ${CYAN}systemctl stop sonaro-gate${RESET}"
    echo ""
    echo -e "  ${BOLD}Files:${RESET}"
    echo -e "    Config:  ${INSTALL_DIR}/.env        ${DIM}(passwords — keep private)${RESET}"
    echo -e "    Service: /etc/systemd/system/sonaro-gate.service"
    echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Run
# ─────────────────────────────────────────────────────────────────────────────
case "$METHOD" in
    docker|Docker|DOCKER|1) install_docker_mode ;;
    native|Native|NATIVE|2) install_native_mode ;;
    *) die "Unknown install method '${METHOD}'. Use 'docker' or 'native'." ;;
esac
