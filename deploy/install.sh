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
hdr()   { echo -e "\n${BOLD}${CYAN}$*${RESET}"; }
row()   { printf "  ${BOLD}%-28s${RESET} %s\n" "$1" "$2"; }
sep()   { echo -e "${DIM}  ──────────────────────────────────────────────────────${RESET}"; }

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

    # OS
    if [[ "$ID" == "ubuntu" && "${VERSION_ID}" == "24.04" ]]; then
        ok "OS: ${PRETTY_NAME} ✓ (fully supported)"
    elif [[ "$ID" == "ubuntu" ]]; then
        warn "OS: ${PRETTY_NAME} — optimised for Ubuntu 24.04 LTS"
    else
        warn "OS: ${PRETTY_NAME} — untested (Ubuntu 24.04 LTS recommended)"
    fi

    # Hardware
    CPU_CORES=$(nproc 2>/dev/null || echo "?")
    RAM_TOTAL=$(free -h 2>/dev/null | awk '/^Mem:/{print $2}' || echo "?")
    DISK_FREE=$(df -h "${INSTALL_DIR%/*}" 2>/dev/null | awk 'NR==2{print $4}' || df -h / | awk 'NR==2{print $4}')

    echo ""
    echo -e "  ${BOLD}Hardware${RESET}"
    printf "    %-22s %s\n" "CPU:" "${CPU_CORES} core(s)"
    printf "    %-22s %s\n" "RAM:" "${RAM_TOTAL}"
    printf "    %-22s %s\n" "Disk free:" "${DISK_FREE}"
    [[ "${CPU_CORES}" -ge 2 ]] 2>/dev/null || warn "Minimum 2 CPU cores recommended (detected: ${CPU_CORES})"

    # Network interfaces
    echo ""
    echo -e "  ${BOLD}Network interfaces${RESET}"
    NIC_COUNT=0
    while IFS= read -r line; do
        IFACE=$(echo "$line" | awk -F': ' '{print $2}' | sed 's/@.*//')
        [[ "$IFACE" == "lo" ]] && continue
        STATE=$(echo "$line" | grep -oP '(?<=state )\S+' || echo "UNKNOWN")
        ADDR=$(ip -4 addr show "$IFACE" 2>/dev/null | grep -oP '(?<=inet )\S+' | head -1 || echo "no IP")
        printf "    %-18s %-10s %s\n" "$IFACE" "$STATE" "$ADDR"
        NIC_COUNT=$(( NIC_COUNT + 1 ))
    done < <(ip -o link show 2>/dev/null | grep -v '^[0-9]*: lo')

    [[ "$NIC_COUNT" -lt 2 ]] && warn "Firewall needs at least 2 NICs (WAN + LAN). Found: ${NIC_COUNT}"

    # Firewall / UFW status
    echo ""
    echo -e "  ${BOLD}Host firewall (UFW)${RESET}"
    if command -v ufw &>/dev/null; then
        UFW_STATUS=$(ufw status 2>/dev/null | head -1 || echo "unknown")
        printf "    %-22s %s\n" "Status:" "$UFW_STATUS"
        if echo "$UFW_STATUS" | grep -qi "active"; then
            warn "UFW is active — installer will open port ${PORT} automatically"
        else
            printf "    %-22s %s\n" "" "${DIM}(UFW inactive — no firewall rules to update)${RESET}"
        fi
    else
        printf "    %-22s %s\n" "UFW:" "${DIM}not installed${RESET}"
    fi

    # Port availability
    echo ""
    echo -e "  ${BOLD}Port ${PORT} availability${RESET}"
    if ss -tlnp 2>/dev/null | grep -q ":${PORT} "; then
        OWNER=$(ss -tlnp 2>/dev/null | grep ":${PORT} " | grep -oP 'users:\(\("\K[^"]+' | head -1 || echo "unknown")
        warn "Port ${PORT} is already in use by: ${OWNER}"
        warn "Set a different port: sudo PORT=8080 bash <(curl -fsSL ...)"
    else
        printf "    %-22s %s\n" "Port ${PORT}:" "${GREEN}available${RESET}"
    fi

    # Internet connectivity
    echo ""
    echo -e "  ${BOLD}Internet connectivity${RESET}"
    for HOST in "github.com" "registry-1.docker.io" "deb.nodesource.com"; do
        if curl -s --connect-timeout 6 "https://${HOST}" > /dev/null 2>&1; then
            printf "    ${GREEN}✓${RESET} %-28s reachable\n" "$HOST"
        else
            printf "    ${YELLOW}✗${RESET} %-28s ${YELLOW}unreachable${RESET}\n" "$HOST"
        fi
    done

    # Pre-installed software
    echo ""
    echo -e "  ${BOLD}Installed software${RESET}"
    for tool in docker git curl openssl node psql suricata wireguard; do
        if command -v "$tool" &>/dev/null; then
            VER=$("$tool" --version 2>/dev/null | head -1 | tr -s ' ' | cut -c1-35 || echo "installed")
            printf "    ${GREEN}✓${RESET} %-18s ${DIM}%s${RESET}\n" "$tool" "$VER"
        else
            printf "    ${DIM}✗ %-18s not installed${RESET}\n" "$tool"
        fi
    done

    echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# OPEN HOST FIREWALL PORTS
# ─────────────────────────────────────────────────────────────────────────────
open_firewall_ports() {
    local _port="$1"
    local opened=0

    # UFW
    if command -v ufw &>/dev/null && ufw status 2>/dev/null | grep -qi "active"; then
        info "UFW is active — opening port ${_port}/tcp..."
        ufw allow "${_port}/tcp" comment "Sonaro Gate web console" >/dev/null
        ok "UFW: port ${_port}/tcp allowed"
        opened=1
    fi

    # iptables INPUT — only add if not already there and not ACCEPT policy
    if command -v iptables &>/dev/null; then
        INPUT_POLICY=$(iptables -L INPUT --line-numbers -n 2>/dev/null | head -2 | grep -oP 'policy \K\S+' || echo "UNKNOWN")
        if [[ "$INPUT_POLICY" == "DROP" || "$INPUT_POLICY" == "REJECT" ]]; then
            if ! iptables -C INPUT -p tcp --dport "${_port}" -j ACCEPT 2>/dev/null; then
                iptables -I INPUT -p tcp --dport "${_port}" -j ACCEPT
                ok "iptables: INPUT ACCEPT tcp/${_port} added"
                opened=1
            fi
        fi
    fi

    [[ "$opened" -eq 0 ]] && ok "Host firewall: port ${_port} already accessible (no rules needed)"
}

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 2 — DETECT AND CLEAN PREVIOUS INSTALL
# ─────────────────────────────────────────────────────────────────────────────
detect_and_clean() {
    local found_docker=0 found_dir=0 found_service=0

    if command -v docker &>/dev/null 2>&1; then
        if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qE '^(sonaro-gate|sonaro-db)$'; then
            found_docker=1
        fi
    fi
    [[ -d "${INSTALL_DIR}" ]] && found_dir=1
    [[ -f /etc/systemd/system/sonaro-gate.service ]] && found_service=1

    local found_any=$(( found_docker + found_dir + found_service ))
    [[ "$found_any" -eq 0 ]] && return 0

    step "Phase 2 — Previous installation detected"
    [[ "$found_docker"  -eq 1 ]] && warn "Found Docker containers: sonaro-gate / sonaro-db"
    [[ "$found_dir"     -eq 1 ]] && warn "Found install directory: ${INSTALL_DIR}"
    [[ "$found_service" -eq 1 ]] && warn "Found systemd service: sonaro-gate.service"

    echo ""
    echo -e "  ${BOLD}The installer will perform a complete clean wipe:${RESET}"
    echo -e "  ${DIM}  • Stop containers / service${RESET}"
    echo -e "  ${DIM}  • Remove Docker containers, image, and volumes${RESET}"
    echo -e "  ${DIM}  • Remove ${INSTALL_DIR}${RESET}"
    echo -e "  ${DIM}  • Remove systemd unit file${RESET}"
    echo -e "  ${YELLOW}  ⚠  All firewall configuration data will be erased${RESET}"
    echo ""

    if [[ -t 0 ]]; then
        read -rp "  Continue with clean reinstall? [Y/n]: " _CONFIRM
        _CONFIRM="${_CONFIRM:-Y}"
        [[ "${_CONFIRM,,}" =~ ^(y|yes)$ ]] || die "Aborted — no changes made"
    else
        info "Non-interactive: clean wipe in 5 seconds... (Ctrl+C to cancel)"
        sleep 5
    fi

    _do_cleanup
}

_do_cleanup() {
    step "Cleaning up previous installation"

    if command -v docker &>/dev/null && [[ -f "$COMPOSE_FILE" ]]; then
        info "Stopping containers..."
        docker compose -f "$COMPOSE_FILE" down -v --remove-orphans 2>/dev/null || true
    fi
    for cname in sonaro-gate sonaro-db; do
        docker rm -f "$cname" 2>/dev/null || true
    done
    for vol in sonaro_pgdata pgdata; do
        docker volume rm "$vol" 2>/dev/null || true
    done
    docker rmi sonaro-gate:latest 2>/dev/null || true

    systemctl stop sonaro-gate 2>/dev/null || true
    systemctl disable sonaro-gate 2>/dev/null || true
    rm -f /etc/systemd/system/sonaro-gate.service
    systemctl daemon-reload 2>/dev/null || true
    rm -f /etc/sysctl.d/99-sonaro.conf
    [[ -d "${INSTALL_DIR}" ]] && { info "Removing ${INSTALL_DIR}..."; rm -rf "${INSTALL_DIR}"; }

    ok "Clean wipe complete — ready for fresh install"
    echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# CHOOSE INSTALL METHOD
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
        info "Non-interactive — defaulting to Docker"
        info "  To use native: sudo INSTALL_METHOD=native bash <(curl -fsSL ...)"
    fi
fi

echo ""
info "Install method : ${BOLD}${METHOD}${RESET}"
info "Install dir    : ${INSTALL_DIR}"
info "Port           : ${PORT}"
echo ""

# Run phases 1 and 2
system_check
detect_and_clean

# ─────────────────────────────────────────────────────────────────────────────
# HELPER — post-install diagnostic check
# ─────────────────────────────────────────────────────────────────────────────
run_post_diagnostics() {
    local _mode="$1"
    local _port="$2"

    step "Post-install diagnostics"

    # Container / service status
    if [[ "$_mode" == "docker" ]]; then
        echo -e "  ${BOLD}Container status:${RESET}"
        docker compose -f "$COMPOSE_FILE" ps 2>/dev/null || true
    else
        echo -e "  ${BOLD}Service status:${RESET}"
        systemctl status sonaro-gate --no-pager -l 2>/dev/null | head -15 || true
    fi

    echo ""
    echo -e "  ${BOLD}Port ${_port} listener:${RESET}"
    if ss -tlnp 2>/dev/null | grep -q ":${_port} "; then
        LISTENER=$(ss -tlnp 2>/dev/null | grep ":${_port} " | head -1)
        echo -e "  ${GREEN}✓ Port ${_port} is listening${RESET}"
        echo "    $LISTENER"
    else
        echo -e "  ${RED}✗ Port ${_port} is NOT listening${RESET}"
        echo ""
        warn "The application did not bind to port ${_port}."
        warn "Check the logs for startup errors:"
        if [[ "$_mode" == "docker" ]]; then
            echo ""
            echo -e "${YELLOW}═══════════════ Container logs (last 40 lines) ══════════════${RESET}"
            docker compose -f "$COMPOSE_FILE" logs --tail=40 sonaro-gate 2>/dev/null || true
            docker compose -f "$COMPOSE_FILE" logs --tail=20 db 2>/dev/null || true
            echo -e "${YELLOW}════════════════════════════════════════════════════════════${RESET}"
        else
            echo ""
            journalctl -u sonaro-gate -n 40 --no-pager 2>/dev/null || true
        fi
    fi

    echo ""
    echo -e "  ${BOLD}UFW status after port opening:${RESET}"
    if command -v ufw &>/dev/null; then
        ufw status numbered 2>/dev/null | grep -E "Status:|${_port}" | head -10 || echo "    (ufw not active)"
    else
        echo "    UFW not installed"
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# HELPER — print the detailed post-install guide
# ─────────────────────────────────────────────────────────────────────────────
print_post_install_guide() {
    local _mode="$1"
    local _port="$2"
    local _lan_ip="$3"

    echo ""
    echo -e "${BOLD}${GREEN}"
    if [[ "$_mode" == "docker" ]]; then
        echo "  ╔════════════════════════════════════════════════════════════╗"
        echo "  ║            DOCKER INSTALL COMPLETE ✓                      ║"
        echo "  ╚════════════════════════════════════════════════════════════╝"
    else
        echo "  ╔════════════════════════════════════════════════════════════╗"
        echo "  ║            NATIVE INSTALL COMPLETE ✓                      ║"
        echo "  ╚════════════════════════════════════════════════════════════╝"
    fi
    echo -e "${RESET}"

    # ── Access info ────────────────────────────────────────────────────────────
    hdr "  ① Access the Web UI"
    sep
    echo -e "  Open a browser on any device in the same network and go to:\n"
    echo -e "  ${BOLD}${CYAN}  http://${_lan_ip}:${_port}${RESET}\n"
    row "Email:"    "admin@sonaro.local"
    row "Password:" "Admin123!"
    echo ""
    echo -e "  ${YELLOW}  ⚠  Change the password immediately after first login!${RESET}"
    echo -e "  ${DIM}     Go to: System → Administrators → Edit → Change Password${RESET}"

    # ── Next step: network config ──────────────────────────────────────────────
    echo ""
    hdr "  ② Configure network interfaces (required before routing traffic)"
    sep
    echo -e "  ${DIM}  Sonaro Gate needs to know which NIC is WAN (internet) and which is LAN.${RESET}"
    echo -e "  ${DIM}  Without this, the firewall cannot route or filter traffic.${RESET}\n"
    echo -e "  ${BOLD}  Your current network interfaces:${RESET}"
    ip -o link show 2>/dev/null | grep -v '^[0-9]*: lo' | while IFS= read -r line; do
        IFACE=$(echo "$line" | awk -F': ' '{print $2}' | sed 's/@.*//')
        STATE=$(echo "$line" | grep -oP '(?<=state )\S+' || echo "?")
        ADDR=$(ip -4 addr show "$IFACE" 2>/dev/null | grep -oP '(?<=inet )\S+' | head -1 || echo "no IP yet")
        printf "    %-16s %-10s %s\n" "$IFACE" "$STATE" "$ADDR"
    done
    echo ""
    echo -e "  Configure via the web UI: ${BOLD}Network → Interfaces${RESET}"
    echo -e "  Or run the CLI wizard:\n"
    if [[ "$_mode" == "docker" ]]; then
        echo -e "    ${CYAN}docker exec -it sonaro-gate bash${RESET}"
    fi
    echo -e "  ${DIM}  See full guide: https://github.com/huynhtrungcsc/sonaro-gate/blob/main/docs/CLI-NETWORK-SETUP.md${RESET}"

    # ── Verify it's running ────────────────────────────────────────────────────
    echo ""
    hdr "  ③ Verify the application is running"
    sep
    if [[ "$_mode" == "docker" ]]; then
        echo -e "  ${DIM}  Check container status:${RESET}"
        echo -e "    ${CYAN}docker compose -f ${INSTALL_DIR}/deploy/docker-compose.prod.yml ps${RESET}"
        echo ""
        echo -e "  ${DIM}  View live application logs:${RESET}"
        echo -e "    ${CYAN}docker compose -f ${INSTALL_DIR}/deploy/docker-compose.prod.yml logs -f sonaro-gate${RESET}"
        echo ""
        echo -e "  ${DIM}  Test the API health endpoint:${RESET}"
        echo -e "    ${CYAN}curl http://127.0.0.1:${_port}/api/health${RESET}"
    else
        echo -e "  ${DIM}  Check service status:${RESET}"
        echo -e "    ${CYAN}systemctl status sonaro-gate${RESET}"
        echo ""
        echo -e "  ${DIM}  View live logs:${RESET}"
        echo -e "    ${CYAN}journalctl -u sonaro-gate -f${RESET}"
        echo ""
        echo -e "  ${DIM}  Test the API health endpoint:${RESET}"
        echo -e "    ${CYAN}curl http://127.0.0.1:${_port}/api/health${RESET}"
    fi

    # ── Security checklist ────────────────────────────────────────────────────
    echo ""
    hdr "  ④ Security checklist (do these right after first login)"
    sep
    echo -e "  ${DIM}□${RESET}  Change the admin password            ${DIM}System → Administrators → Edit${RESET}"
    echo -e "  ${DIM}□${RESET}  Set hostname and timezone             ${DIM}System → Settings${RESET}"
    echo -e "  ${DIM}□${RESET}  Review the default firewall policy    ${DIM}Firewall → Policy & Objects${RESET}"
    echo -e "  ${DIM}□${RESET}  Assign WAN and LAN interfaces         ${DIM}Network → Interfaces${RESET}"
    echo -e "  ${DIM}□${RESET}  Enable IDS/IPS                        ${DIM}Security → IDS/IPS${RESET}"

    # ── Management commands ────────────────────────────────────────────────────
    echo ""
    hdr "  ⑤ Day-to-day management commands"
    sep
    if [[ "$_mode" == "docker" ]]; then
        local CF="${INSTALL_DIR}/deploy/docker-compose.prod.yml"
        echo -e "  ${BOLD}  Container control:${RESET}"
        row "    Start:"   "docker compose -f ${CF} up -d"
        row "    Stop:"    "docker compose -f ${CF} down"
        row "    Restart:" "docker compose -f ${CF} restart"
        row "    Logs:"    "docker compose -f ${CF} logs -f"
        echo ""
        echo -e "  ${BOLD}  Update to latest version:${RESET}"
        echo -e "    ${CYAN}git -C ${INSTALL_DIR} pull && docker compose -f ${CF} up -d --build${RESET}"
        echo ""
        echo -e "  ${BOLD}  Open a shell inside the container:${RESET}"
        echo -e "    ${CYAN}docker exec -it sonaro-gate bash${RESET}"
    else
        echo -e "  ${BOLD}  Service control:${RESET}"
        row "    Status:"  "systemctl status sonaro-gate"
        row "    Start:"   "systemctl start sonaro-gate"
        row "    Stop:"    "systemctl stop sonaro-gate"
        row "    Restart:" "systemctl restart sonaro-gate"
        row "    Logs:"    "journalctl -u sonaro-gate -f"
    fi

    # ── File locations ────────────────────────────────────────────────────────
    echo ""
    hdr "  ⑥ Important file locations"
    sep
    row "    Install dir:"   "${INSTALL_DIR}"
    row "    Config (.env):" "${INSTALL_DIR}/.env  ${DIM}← passwords & secrets — keep private!${RESET}"
    if [[ "$_mode" == "docker" ]]; then
        row "    DB data:"       "Docker volume  ${DIM}pgdata${RESET}  (run: docker volume inspect pgdata)"
        row "    Compose file:"  "${INSTALL_DIR}/deploy/docker-compose.prod.yml"
    else
        row "    DB data:"       "/var/lib/postgresql/  (PostgreSQL data directory)"
        row "    Service file:"  "/etc/systemd/system/sonaro-gate.service"
        row "    Sysctl:"        "/etc/sysctl.d/99-sonaro.conf"
    fi

    # ── Troubleshooting tips ──────────────────────────────────────────────────
    echo ""
    hdr "  ⑦ If you cannot access the web UI"
    sep
    echo -e "  ${DIM}1. Verify the app is running:${RESET}"
    if [[ "$_mode" == "docker" ]]; then
        echo -e "     ${CYAN}docker compose -f ${INSTALL_DIR}/deploy/docker-compose.prod.yml ps${RESET}"
    else
        echo -e "     ${CYAN}systemctl status sonaro-gate${RESET}"
    fi
    echo ""
    echo -e "  ${DIM}2. Check the port is open:${RESET}"
    echo -e "     ${CYAN}ss -tlnp | grep ${_port}${RESET}"
    echo ""
    echo -e "  ${DIM}3. Check UFW is not blocking it:${RESET}"
    echo -e "     ${CYAN}ufw status numbered${RESET}"
    echo -e "     ${CYAN}ufw allow ${_port}/tcp${RESET}   ${DIM}← run this if ${_port} is not in the list${RESET}"
    echo ""
    echo -e "  ${DIM}4. Test locally on the server itself:${RESET}"
    echo -e "     ${CYAN}curl http://127.0.0.1:${_port}/api/health${RESET}"
    echo ""
    echo -e "  ${DIM}5. You must connect from the correct network side (same subnet as the server)${RESET}"
    echo ""
    echo -e "  ${DIM}Full troubleshooting guide:${RESET}"
    echo -e "  ${DIM}https://github.com/huynhtrungcsc/sonaro-gate/blob/main/docs/DEPLOY.md#10-troubleshooting${RESET}"
    echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# DOCKER INSTALL
# ─────────────────────────────────────────────────────────────────────────────
install_docker_mode() {

    # ── Step 1: Docker Engine ─────────────────────────────────────────────────
    step "Step 1/6 — Docker Engine"

    if command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
        ok "Docker $(docker --version | awk '{print $3}' | tr -d ',') already installed — skipping"
    else
        info "Installing Docker Engine from official repository..."
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
    step "Step 2/6 — Download source"

    apt-get install -y -qq git 2>/dev/null || true

    info "Cloning repository..."
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
    ok "Source ready at ${INSTALL_DIR}"

    # ── Step 3: Write .env ────────────────────────────────────────────────────
    step "Step 3/6 — Environment configuration"

    cat > "${INSTALL_DIR}/.env" <<ENV
# Sonaro Gate — Environment Configuration
# Generated by install.sh (Docker mode) on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# !! Keep this file private — contains database credentials and JWT secret !!

NODE_ENV=production
PORT=${PORT}

POSTGRES_DB=${DB_NAME}
POSTGRES_USER=${DB_USER}
POSTGRES_PASSWORD=${DB_PASS}

DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}
JWT_SECRET=${JWT_SECRET}

SONARO_SKIP_SETUP=
ENV

    chmod 600 "${INSTALL_DIR}/.env"
    ok ".env written (chmod 600)"

    # ── Step 4: Open firewall ports ────────────────────────────────────────────
    step "Step 4/6 — Opening firewall port ${PORT}"
    open_firewall_ports "$PORT"

    # ── Step 5: Build and start ────────────────────────────────────────────────
    step "Step 5/6 — Build Docker image and start containers"

    cd "$INSTALL_DIR"

    info "Building Docker image (compiling TypeScript + React frontend)..."
    info "First run takes 3–5 minutes — please wait..."
    docker compose -f deploy/docker-compose.prod.yml --env-file .env build

    info "Starting containers (PostgreSQL + Sonaro Gate)..."
    docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d
    ok "Containers started"

    # ── Step 6: Health check ───────────────────────────────────────────────────
    step "Step 6/6 — Waiting for application to become ready"

    info "Polling http://127.0.0.1:${PORT}/api/health (up to 3 minutes)..."
    HEALTH_OK=0
    for (( i=1; i<=36; i++ )); do
        if curl -sf "http://127.0.0.1:${PORT}/api/health" &>/dev/null; then
            ok "Application is ready! (after $((i*5)) seconds)"
            HEALTH_OK=1
            break
        fi
        printf "  Waiting... %ds elapsed\r" $((i*5))
        sleep 5
    done
    echo ""

    if [[ "$HEALTH_OK" -eq 0 ]]; then
        warn "Health check timed out after 3 minutes."
        warn "Showing container logs to help diagnose the issue:"
        echo ""
        echo -e "${YELLOW}═══════════════ sonaro-gate logs (last 50 lines) ══════════════${RESET}"
        docker compose -f deploy/docker-compose.prod.yml logs --tail=50 sonaro-gate 2>/dev/null || true
        echo -e "${YELLOW}══════════════════════════════════════════════════════════════${RESET}"
        echo ""
        echo -e "${YELLOW}═════════════════════ db logs (last 20 lines) ══════════════════${RESET}"
        docker compose -f deploy/docker-compose.prod.yml logs --tail=20 db 2>/dev/null || true
        echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${RESET}"
        echo ""
        warn "You can retry the health check manually:"
        warn "  curl http://127.0.0.1:${PORT}/api/health"
    fi

    # ── Diagnostics + summary ──────────────────────────────────────────────────
    run_post_diagnostics "docker" "$PORT"

    LAN_IP=$(ip route get 1 2>/dev/null | grep -oP 'src \K\S+' | head -1 || echo "<YOUR_SERVER_IP>")
    print_post_install_guide "docker" "$PORT" "$LAN_IP"
}

# ─────────────────────────────────────────────────────────────────────────────
# NATIVE INSTALL
# ─────────────────────────────────────────────────────────────────────────────
install_native_mode() {

    export DEBIAN_FRONTEND=noninteractive

    # ── Step 1: System packages ────────────────────────────────────────────────
    step "Step 1/7 — Installing system packages"
    apt-get update -qq
    apt-get install -y -qq \
        curl wget gnupg ca-certificates lsb-release \
        iptables iptables-persistent netfilter-persistent \
        iproute2 ipset netplan.io \
        postgresql postgresql-client \
        git build-essential \
        suricata suricata-update \
        wireguard wireguard-tools \
        dnsmasq openssl jq
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

    # ── Step 3: Clone and build ────────────────────────────────────────────────
    step "Step 3/7 — Download and build source"
    info "Cloning repository..."
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    info "Installing npm dependencies..."
    npm ci --omit=dev --silent
    info "Building frontend..."
    npm run build
    ok "Application built at ${INSTALL_DIR}"

    # ── Step 4: Kernel network settings ──────────────────────────────────────
    step "Step 4/7 — Kernel network settings"
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
    sleep 2
    sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" 2>/dev/null \
        || sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" 2>/dev/null || true
    ok "Database ${DB_NAME} ready"

    # ── Step 6: Config + migrations ───────────────────────────────────────────
    step "Step 6/7 — Configuration and database schema"
    DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"

    cat > "${INSTALL_DIR}/.env" <<ENV
# Sonaro Gate — Environment Configuration
# Generated by install.sh (native mode) on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# !! Keep this file private — contains database credentials and JWT secret !!

NODE_ENV=production
PORT=${PORT}
DATABASE_URL=${DATABASE_URL}
JWT_SECRET=${JWT_SECRET}
SONARO_SKIP_SETUP=
ENV

    chmod 600 "${INSTALL_DIR}/.env"
    cd "$INSTALL_DIR"
    info "Running database migrations..."
    DATABASE_URL="$DATABASE_URL" npx drizzle-kit push --force 2>/dev/null
    info "Seeding initial data..."
    DATABASE_URL="$DATABASE_URL" npx tsx server/seed.ts
    ok "Database schema and seed data applied"

    info "Configuring Suricata IPS..."
    mkdir -p /etc/suricata/rules
    touch /etc/suricata/rules/sonaro-local.rules
    suricata-update --no-reload 2>/dev/null || warn "suricata-update failed (check internet)"
    systemctl enable --now suricata 2>/dev/null || true
    ok "Suricata IPS ready"

    # ── Step 7: Open ports + systemd service ──────────────────────────────────
    step "Step 7/7 — Opening firewall port and starting service"

    open_firewall_ports "$PORT"

    cp "${INSTALL_DIR}/deploy/sonaro-gate.service" /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable sonaro-gate
    systemctl start sonaro-gate
    ok "sonaro-gate.service started and enabled"

    # Give it a moment to bind
    sleep 3

    # ── Diagnostics + summary ──────────────────────────────────────────────────
    run_post_diagnostics "native" "$PORT"

    LAN_IP=$(ip route get 1 2>/dev/null | grep -oP 'src \K\S+' | head -1 || echo "<YOUR_SERVER_IP>")
    print_post_install_guide "native" "$PORT" "$LAN_IP"
}

# ─────────────────────────────────────────────────────────────────────────────
# Run
# ─────────────────────────────────────────────────────────────────────────────
case "$METHOD" in
    docker|Docker|DOCKER|1) install_docker_mode ;;
    native|Native|NATIVE|2) install_native_mode ;;
    *) die "Unknown install method '${METHOD}'. Use 'docker' or 'native'." ;;
esac
