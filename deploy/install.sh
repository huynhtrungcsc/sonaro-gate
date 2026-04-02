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

# Note: -o pipefail is intentionally NOT used — pipeline failures (e.g. head
# causing SIGPIPE) would silently kill the script on legitimate commands.
set -eu

# ── Colour helpers ─────────────────────────────────────────────────────────────
# Use $'...' C-style strings so \033 is interpreted as ESC, not literal backslash
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'
BOLD=$'\033[1m'
DIM=$'\033[2m'
RESET=$'\033[0m'

info()  { echo -e "${CYAN}[INFO]${RESET}  $*"; }
ok()    { echo -e "${GREEN}[  OK ]${RESET}  $*"; }
warn()  { echo -e "${YELLOW}[ WARN]${RESET}  $*"; }
step()  { echo -e "\n${BOLD}${CYAN}── $* ${RESET}"; }
die()   { echo -e "${RED}[ERROR]${RESET}  $*" >&2; exit 1; }
hdr()   { echo -e "\n${BOLD}${CYAN}$*${RESET}"; }
row()   { echo -e "  ${BOLD}$(printf '%-28s' "$1")${RESET} $2"; }
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
# HELPER — detect whether UFW is truly enabled (not just installed)
# Returns 0 = active, 1 = inactive/not installed
# ─────────────────────────────────────────────────────────────────────────────
ufw_is_active() {
    command -v ufw &>/dev/null || return 1
    # "ufw status" prints "Status: active" or "Status: inactive"
    # We must match the FULL word "active" not just a substring (inactive contains active)
    ufw status 2>/dev/null | head -1 | grep -qx "Status: active"
}

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 1 — SYSTEM CHECK
# ─────────────────────────────────────────────────────────────────────────────
system_check() {
    step "Phase 1 — System check"

    # OS
    if [[ "${ID:-}" == "ubuntu" && "${VERSION_ID:-}" == "24.04" ]]; then
        ok "OS: ${PRETTY_NAME} ✓ (fully supported)"
    elif [[ "${ID:-}" == "ubuntu" ]]; then
        warn "OS: ${PRETTY_NAME} — optimised for Ubuntu 24.04 LTS"
    else
        warn "OS: ${PRETTY_NAME:-unknown} — untested (Ubuntu 24.04 LTS recommended)"
    fi

    # Hardware
    local cpu ram disk
    cpu=$(nproc 2>/dev/null || echo "?")
    ram=$(free -h 2>/dev/null | awk '/^Mem:/{print $2}' || echo "?")
    disk=$(df -h / 2>/dev/null | awk 'NR==2{print $4}' || echo "?")

    echo ""
    echo -e "  ${BOLD}Hardware${RESET}"
    echo "    CPU:         ${cpu} core(s)"
    echo "    RAM:         ${ram}"
    echo "    Disk free:   ${disk}  (on /)"
    [[ "$cpu" -ge 2 ]] 2>/dev/null || warn "Minimum 2 CPU cores recommended (found: ${cpu})"

    # Network interfaces
    echo ""
    echo -e "  ${BOLD}Network interfaces${RESET}"
    local nic_count=0
    while IFS= read -r line; do
        local iface state addr
        iface=$(echo "$line" | awk -F': ' '{print $2}' | sed 's/@.*//')
        [[ "$iface" == "lo" ]] && continue
        state=$(echo "$line" | grep -oP '(?<=state )\S+' || echo "?")
        addr=$(ip -4 addr show "$iface" 2>/dev/null | grep -oP '(?<=inet )\S+' | head -1 || true)
        [[ -z "$addr" ]] && addr="no IP"
        printf "    %-18s %-10s %s\n" "$iface" "$state" "$addr"
        nic_count=$(( nic_count + 1 ))
    done < <(ip -o link show 2>/dev/null | grep -v '^[0-9]*: lo')
    [[ "$nic_count" -lt 2 ]] && warn "Firewall requires at least 2 NICs (WAN + LAN). Found: ${nic_count}"

    # UFW status — precise check
    echo ""
    echo -e "  ${BOLD}Host firewall (UFW)${RESET}"
    if command -v ufw &>/dev/null; then
        local ufw_line
        ufw_line=$(ufw status 2>/dev/null | head -1 || echo "Status: unknown")
        echo "    ${ufw_line}"
        if ufw_is_active; then
            warn "UFW is active — installer will open port ${PORT}/tcp automatically"
        else
            echo -e "    ${DIM}(UFW inactive — no firewall rules to update)${RESET}"
        fi
    else
        echo -e "    ${DIM}UFW not installed${RESET}"
    fi

    # Port check
    echo ""
    echo -e "  ${BOLD}Port ${PORT} availability${RESET}"
    if ss -tlnp 2>/dev/null | grep -q ":${PORT} "; then
        local owner
        owner=$(ss -tlnp 2>/dev/null | grep ":${PORT} " | grep -oP 'users:\(\("\K[^"]+' | head -1 || echo "unknown")
        warn "Port ${PORT} is ALREADY IN USE by: ${owner}"
        warn "Set a different port: sudo PORT=8080 bash <(curl -fsSL ...)"
    else
        echo -e "    Port ${PORT}:  ${GREEN}available${RESET}"
    fi

    # Internet
    echo ""
    echo -e "  ${BOLD}Internet connectivity${RESET}"
    for HOST in "github.com" "registry-1.docker.io" "deb.nodesource.com"; do
        if curl -s --connect-timeout 6 "https://${HOST}" > /dev/null 2>&1; then
            echo -e "    ${GREEN}✓${RESET}  ${HOST}"
        else
            echo -e "    ${YELLOW}✗${RESET}  ${HOST}  ${YELLOW}(unreachable)${RESET}"
        fi
    done

    # Pre-installed software
    echo ""
    echo -e "  ${BOLD}Installed software${RESET}"
    for tool in docker git curl openssl node psql suricata wireguard; do
        if command -v "$tool" &>/dev/null; then
            local ver
            ver=$("$tool" --version 2>/dev/null | head -1 | cut -c1-40 || echo "installed")
            echo -e "    ${GREEN}✓${RESET}  $(printf '%-16s' "$tool")  ${DIM}${ver}${RESET}"
        else
            echo -e "    ${DIM}✗  $(printf '%-16s' "$tool")  not installed${RESET}"
        fi
    done

    echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# OPEN HOST FIREWALL PORTS  (safe — uses || true everywhere)
# ─────────────────────────────────────────────────────────────────────────────
open_firewall_ports() {
    local _port="$1"
    local opened=0

    # ── UFW ───────────────────────────────────────────────────────────────────
    if ufw_is_active; then
        info "UFW is ACTIVE — opening port ${_port}/tcp..."
        # Remove `comment` keyword: not all UFW versions support it
        if ufw allow "${_port}/tcp" >/dev/null 2>&1; then
            ok "UFW: port ${_port}/tcp → ALLOW ✓"
            opened=1
        else
            warn "ufw allow command failed — try manually: sudo ufw allow ${_port}/tcp"
        fi
    fi

    # ── iptables INPUT chain ───────────────────────────────────────────────────
    # Only add a rule if the INPUT default policy is DROP or REJECT
    if command -v iptables &>/dev/null; then
        local _policy
        # Use awk to avoid head-induced SIGPIPE under set -e
        _policy=$(iptables -L INPUT -n 2>/dev/null \
            | awk '/^Chain INPUT/{match($0,/policy ([A-Z]+)/,a); print a[1]; exit}') \
            || _policy="UNKNOWN"
        [[ -z "$_policy" ]] && _policy="UNKNOWN"

        if [[ "$_policy" == "DROP" || "$_policy" == "REJECT" ]]; then
            info "iptables INPUT policy is ${_policy} — adding ACCEPT rule for port ${_port}/tcp"
            # Check if rule already exists (-C returns 0 if exists)
            if ! iptables -C INPUT -p tcp --dport "${_port}" -j ACCEPT 2>/dev/null; then
                iptables -I INPUT -p tcp --dport "${_port}" -j ACCEPT 2>/dev/null \
                    && ok "iptables: ACCEPT tcp/${_port} added to INPUT chain" \
                    || warn "iptables insert failed — rule may already exist"
            else
                ok "iptables: ACCEPT rule for tcp/${_port} already present"
            fi
            opened=1
        else
            # Policy is ACCEPT (default Ubuntu) — no iptables rule needed
            true
        fi
    fi

    if [[ "$opened" -eq 0 ]]; then
        ok "Host firewall: port ${_port} accessible (no rule changes needed)"
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 2 — DETECT AND CLEAN PREVIOUS INSTALL
# ─────────────────────────────────────────────────────────────────────────────
detect_and_clean() {
    local found_docker=0 found_dir=0 found_service=0

    if command -v docker &>/dev/null; then
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
    echo -e "  ${YELLOW}  ⚠  All configuration data will be erased (fresh start)${RESET}"
    echo ""

    if [[ -t 0 ]]; then
        read -rp "  Continue with clean reinstall? [Y/n]: " _CONFIRM
        _CONFIRM="${_CONFIRM:-Y}"
        [[ "${_CONFIRM,,}" =~ ^(y|yes)$ ]] || die "Aborted — no changes made"
    else
        info "Non-interactive mode: clean wipe in 5 seconds... (Ctrl+C to cancel)"
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
    docker rm -f sonaro-gate sonaro-db 2>/dev/null || true
    docker volume rm sonaro_pgdata pgdata 2>/dev/null || true
    docker rmi sonaro-gate:latest 2>/dev/null || true

    systemctl stop sonaro-gate 2>/dev/null || true
    systemctl disable sonaro-gate 2>/dev/null || true
    rm -f /etc/systemd/system/sonaro-gate.service
    systemctl daemon-reload 2>/dev/null || true
    rm -f /etc/sysctl.d/99-sonaro.conf
    [[ -d "${INSTALL_DIR}" ]] && { info "Removing ${INSTALL_DIR}..."; rm -rf "${INSTALL_DIR}"; }

    ok "Previous installation removed — fresh install ready"
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

    if [[ "$_mode" == "docker" ]]; then
        echo -e "  ${BOLD}Container status:${RESET}"
        docker compose -f "$COMPOSE_FILE" ps 2>/dev/null || true
    else
        echo -e "  ${BOLD}Service status:${RESET}"
        systemctl status sonaro-gate --no-pager -l 2>/dev/null | head -12 || true
    fi

    echo ""
    echo -e "  ${BOLD}Port ${_port} listener:${RESET}"
    if ss -tlnp 2>/dev/null | grep -q ":${_port} "; then
        echo -e "  ${GREEN}✓  Port ${_port} is listening — application is UP${RESET}"
    else
        echo -e "  ${RED}✗  Port ${_port} is NOT listening${RESET}"
        echo ""
        warn "The application did not bind to port ${_port}."
        if [[ "$_mode" == "docker" ]]; then
            warn "Last 50 lines of container logs:"
            echo ""
            echo -e "${YELLOW}═══════════════ sonaro-gate (last 50 lines) ════════════════${RESET}"
            docker compose -f "$COMPOSE_FILE" logs --tail=50 sonaro-gate 2>/dev/null || true
            echo -e "${YELLOW}═══════════════════════════════════════════════════════════${RESET}"
            echo ""
            echo -e "${YELLOW}════════════════ db (last 20 lines) ═══════════════════════${RESET}"
            docker compose -f "$COMPOSE_FILE" logs --tail=20 db 2>/dev/null || true
            echo -e "${YELLOW}═══════════════════════════════════════════════════════════${RESET}"
        else
            journalctl -u sonaro-gate -n 40 --no-pager 2>/dev/null || true
        fi
    fi

    echo ""
    echo -e "  ${BOLD}UFW rules (port ${_port}):${RESET}"
    if command -v ufw &>/dev/null && ufw_is_active; then
        ufw status numbered 2>/dev/null | grep -E "${_port}" || echo "    (no rule found for ${_port})"
    else
        echo "    UFW is inactive"
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
    echo "  ╔════════════════════════════════════════════════════════════╗"
    if [[ "$_mode" == "docker" ]]; then
        echo "  ║            DOCKER INSTALL COMPLETE ✓                      ║"
    else
        echo "  ║            NATIVE INSTALL COMPLETE ✓                      ║"
    fi
    echo "  ╚════════════════════════════════════════════════════════════╝"
    echo -e "${RESET}"

    # ── ① Access ──────────────────────────────────────────────────────────────
    hdr "  ① Access the web interface"
    sep
    echo -e "  Open a browser on any device on the same network:\n"
    echo -e "    ${BOLD}${CYAN}http://${_lan_ip}:${_port}${RESET}\n"
    echo -e "    Email:     ${BOLD}admin@sonaro.local${RESET}"
    echo -e "    Password:  ${BOLD}Admin123!${RESET}"
    echo ""
    echo -e "  ${YELLOW}  ⚠  Change the password immediately after first login!${RESET}"
    echo -e "  ${DIM}     System → Administrators → Click admin → Change Password${RESET}"

    # ── ② Network interfaces ──────────────────────────────────────────────────
    echo ""
    hdr "  ② Configure network interfaces  (required for traffic routing)"
    sep
    echo -e "  ${DIM}  Assign which NIC is WAN (internet), LAN, and DMZ.${RESET}"
    echo -e "  ${DIM}  Without this, traffic cannot pass through the firewall.${RESET}\n"
    echo -e "  ${BOLD}  Your current interfaces:${RESET}"
    ip -o link show 2>/dev/null | grep -v '^[0-9]*: lo' | while IFS= read -r line; do
        local iface state addr
        iface=$(echo "$line" | awk -F': ' '{print $2}' | sed 's/@.*//')
        state=$(echo "$line" | grep -oP '(?<=state )\S+' || echo "?")
        addr=$(ip -4 addr show "$iface" 2>/dev/null | grep -oP '(?<=inet )\S+' | head -1 || true)
        [[ -z "$addr" ]] && addr="no IP yet"
        printf "    %-16s %-10s %s\n" "$iface" "$state" "$addr"
    done
    echo ""
    echo -e "  Configure in the web UI: ${BOLD}Network → Interfaces${RESET}"
    echo -e "  ${DIM}  Full guide: https://github.com/huynhtrungcsc/sonaro-gate/blob/main/docs/CLI-NETWORK-SETUP.md${RESET}"

    # ── ③ Verify ──────────────────────────────────────────────────────────────
    echo ""
    hdr "  ③ Verify the application is running"
    sep
    if [[ "$_mode" == "docker" ]]; then
        local CF="${INSTALL_DIR}/deploy/docker-compose.prod.yml"
        echo -e "  ${DIM}Container status:${RESET}"
        echo -e "    ${CYAN}docker compose -f ${CF} ps${RESET}"
        echo ""
        echo -e "  ${DIM}Live application logs:${RESET}"
        echo -e "    ${CYAN}docker compose -f ${CF} logs -f sonaro-gate${RESET}"
        echo ""
        echo -e "  ${DIM}API health check:${RESET}"
        echo -e "    ${CYAN}curl http://127.0.0.1:${_port}/api/health${RESET}"
    else
        echo -e "  ${DIM}Service status:${RESET}"
        echo -e "    ${CYAN}systemctl status sonaro-gate${RESET}"
        echo ""
        echo -e "  ${DIM}Live logs:${RESET}"
        echo -e "    ${CYAN}journalctl -u sonaro-gate -f${RESET}"
        echo ""
        echo -e "  ${DIM}API health check:${RESET}"
        echo -e "    ${CYAN}curl http://127.0.0.1:${_port}/api/health${RESET}"
    fi

    # ── ④ Security checklist ──────────────────────────────────────────────────
    echo ""
    hdr "  ④ Security checklist  (do these right after first login)"
    sep
    echo -e "  ${DIM}☐${RESET}  Change admin password          ${DIM}→ System → Administrators → Edit${RESET}"
    echo -e "  ${DIM}☐${RESET}  Set hostname and timezone      ${DIM}→ System → Settings${RESET}"
    echo -e "  ${DIM}☐${RESET}  Review default firewall policy ${DIM}→ Firewall → Policy & Objects${RESET}"
    echo -e "  ${DIM}☐${RESET}  Assign WAN and LAN interfaces  ${DIM}→ Network → Interfaces${RESET}"
    echo -e "  ${DIM}☐${RESET}  Enable IDS/IPS                 ${DIM}→ Security → IDS/IPS${RESET}"

    # ── ⑤ Management commands ─────────────────────────────────────────────────
    echo ""
    hdr "  ⑤ Management commands"
    sep
    if [[ "$_mode" == "docker" ]]; then
        local CF="${INSTALL_DIR}/deploy/docker-compose.prod.yml"
        echo -e "  ${DIM}Start:${RESET}       ${CYAN}docker compose -f ${CF} up -d${RESET}"
        echo -e "  ${DIM}Stop:${RESET}        ${CYAN}docker compose -f ${CF} down${RESET}"
        echo -e "  ${DIM}Restart:${RESET}     ${CYAN}docker compose -f ${CF} restart${RESET}"
        echo -e "  ${DIM}Logs:${RESET}        ${CYAN}docker compose -f ${CF} logs -f${RESET}"
        echo -e "  ${DIM}Shell access:${RESET} ${CYAN}docker exec -it sonaro-gate bash${RESET}"
        echo ""
        echo -e "  ${DIM}Update to latest:${RESET}"
        echo -e "    ${CYAN}git -C ${INSTALL_DIR} pull && docker compose -f ${CF} up -d --build${RESET}"
    else
        echo -e "  ${DIM}Status:${RESET}  ${CYAN}systemctl status sonaro-gate${RESET}"
        echo -e "  ${DIM}Start:${RESET}   ${CYAN}systemctl start sonaro-gate${RESET}"
        echo -e "  ${DIM}Stop:${RESET}    ${CYAN}systemctl stop sonaro-gate${RESET}"
        echo -e "  ${DIM}Restart:${RESET} ${CYAN}systemctl restart sonaro-gate${RESET}"
        echo -e "  ${DIM}Logs:${RESET}    ${CYAN}journalctl -u sonaro-gate -f${RESET}"
    fi

    # ── ⑥ File locations ──────────────────────────────────────────────────────
    echo ""
    hdr "  ⑥ Important file locations"
    sep
    echo -e "  ${DIM}Install dir:${RESET}   ${INSTALL_DIR}"
    echo -e "  ${DIM}Config (.env):${RESET} ${INSTALL_DIR}/.env   ${YELLOW}← keep private! contains passwords${RESET}"
    if [[ "$_mode" == "docker" ]]; then
        echo -e "  ${DIM}DB data:${RESET}       Docker volume  ${CYAN}pgdata${RESET}  (docker volume inspect pgdata)"
        echo -e "  ${DIM}Compose file:${RESET}  ${INSTALL_DIR}/deploy/docker-compose.prod.yml"
    else
        echo -e "  ${DIM}DB data:${RESET}       /var/lib/postgresql/"
        echo -e "  ${DIM}Service:${RESET}       /etc/systemd/system/sonaro-gate.service"
    fi

    # ── ⑦ Troubleshooting ─────────────────────────────────────────────────────
    echo ""
    hdr "  ⑦ Cannot access the web UI? — try these steps in order"
    sep
    echo -e "  ${BOLD}  1. Is the app running?${RESET}"
    if [[ "$_mode" == "docker" ]]; then
        echo -e "     ${CYAN}docker compose -f ${INSTALL_DIR}/deploy/docker-compose.prod.yml ps${RESET}"
    else
        echo -e "     ${CYAN}systemctl status sonaro-gate${RESET}"
    fi
    echo ""
    echo -e "  ${BOLD}  2. Is the port listening?${RESET}"
    echo -e "     ${CYAN}ss -tlnp | grep ${_port}${RESET}"
    echo -e "     ${DIM}     → Should show LISTEN on 0.0.0.0:${_port}${RESET}"
    echo ""
    echo -e "  ${BOLD}  3. Is UFW blocking the port?${RESET}"
    echo -e "     ${CYAN}ufw status numbered${RESET}"
    echo -e "     ${DIM}     → If ${_port} is not listed, run:${RESET}"
    echo -e "     ${CYAN}ufw allow ${_port}/tcp && ufw reload${RESET}"
    echo ""
    echo -e "  ${BOLD}  4. Test access locally on the server${RESET}"
    echo -e "     ${CYAN}curl -v http://127.0.0.1:${_port}/api/health${RESET}"
    echo -e "     ${DIM}     → Should return: {\"status\":\"ok\"}${RESET}"
    echo ""
    echo -e "  ${BOLD}  5. Test from a remote machine (ping the server first)${RESET}"
    echo -e "     ${CYAN}ping ${_lan_ip}${RESET}"
    echo -e "     ${CYAN}curl http://${_lan_ip}:${_port}/api/health${RESET}"
    echo ""
    echo -e "  ${DIM}  Full troubleshooting guide:${RESET}"
    echo -e "  ${DIM}  https://github.com/huynhtrungcsc/sonaro-gate/blob/main/docs/DEPLOY.md${RESET}"
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
# Keep this file private — it contains database credentials and JWT secret.

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
    ok ".env written and protected (chmod 600)"

    # ── Step 4: Open firewall ports ────────────────────────────────────────────
    step "Step 4/6 — Opening firewall port ${PORT}"
    open_firewall_ports "$PORT"

    # ── Step 5: Build and start ────────────────────────────────────────────────
    step "Step 5/6 — Build Docker image and start containers"

    cd "$INSTALL_DIR"
    info "Building Docker image (compiles TypeScript + React frontend)..."
    info "First run takes 3–5 minutes — please wait..."
    docker compose -f deploy/docker-compose.prod.yml --env-file .env build

    info "Starting containers (PostgreSQL + Sonaro Gate)..."
    docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d
    ok "Containers started"

    # ── Step 6: Health check ───────────────────────────────────────────────────
    step "Step 6/6 — Waiting for application to become ready"
    info "Polling http://127.0.0.1:${PORT}/api/health (up to 3 minutes)..."

    local HEALTH_OK=0
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
        echo -e "${YELLOW}═══════════════ sonaro-gate (last 50 lines) ════════════════${RESET}"
        docker compose -f deploy/docker-compose.prod.yml logs --tail=50 sonaro-gate 2>/dev/null || true
        echo -e "${YELLOW}═══════════════════════════════════════════════════════════${RESET}"
        echo ""
        echo -e "${YELLOW}════════════════ db (last 20 lines) ═══════════════════════${RESET}"
        docker compose -f deploy/docker-compose.prod.yml logs --tail=20 db 2>/dev/null || true
        echo -e "${YELLOW}═══════════════════════════════════════════════════════════${RESET}"
    fi

    run_post_diagnostics "docker" "$PORT"
    local LAN_IP
    LAN_IP=$(ip route get 1 2>/dev/null | grep -oP 'src \K\S+' | head -1 || echo "<YOUR_SERVER_IP>")
    print_post_install_guide "docker" "$PORT" "$LAN_IP"
}

# ─────────────────────────────────────────────────────────────────────────────
# NATIVE INSTALL
# ─────────────────────────────────────────────────────────────────────────────
install_native_mode() {

    export DEBIAN_FRONTEND=noninteractive

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

    step "Step 2/7 — Node.js 20"
    if command -v node &>/dev/null && [[ "$(node -v 2>/dev/null)" == v20* ]]; then
        ok "Node.js $(node -v) already installed — skipping"
    else
        info "Installing Node.js 20 from NodeSource..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
        apt-get install -y -qq nodejs
        ok "Node.js $(node -v) installed"
    fi

    step "Step 3/7 — Download and build source"
    info "Cloning repository..."
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    info "Installing npm dependencies..."
    npm ci --omit=dev --silent
    info "Building frontend..."
    npm run build
    ok "Application built at ${INSTALL_DIR}"

    step "Step 4/7 — Kernel network settings"
    sysctl -w net.ipv4.ip_forward=1 >/dev/null
    {
        echo "net.ipv4.ip_forward=1"
        echo "net.ipv6.conf.all.forwarding=1"
        echo "net.ipv4.conf.all.rp_filter=0"
    } > /etc/sysctl.d/99-sonaro.conf
    sysctl -p /etc/sysctl.d/99-sonaro.conf >/dev/null
    ok "IP forwarding enabled and persisted"

    step "Step 5/7 — PostgreSQL database"
    systemctl enable --now postgresql
    sleep 2
    sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" 2>/dev/null \
        || sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" 2>/dev/null || true
    ok "Database ${DB_NAME} ready"

    step "Step 6/7 — Configuration and database schema"
    local DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"

    cat > "${INSTALL_DIR}/.env" <<ENV
# Sonaro Gate — Environment Configuration
# Generated by install.sh (native mode) on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Keep this file private — it contains database credentials and JWT secret.

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
    ok "Database schema and initial data applied"

    info "Configuring Suricata IPS..."
    mkdir -p /etc/suricata/rules
    touch /etc/suricata/rules/sonaro-local.rules
    suricata-update --no-reload 2>/dev/null || warn "suricata-update failed (check internet)"
    systemctl enable --now suricata 2>/dev/null || true
    ok "Suricata configured"

    step "Step 7/7 — Opening firewall port and starting service"
    open_firewall_ports "$PORT"

    cp "${INSTALL_DIR}/deploy/sonaro-gate.service" /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable sonaro-gate
    systemctl start sonaro-gate
    sleep 3
    ok "sonaro-gate.service started and enabled on boot"

    run_post_diagnostics "native" "$PORT"
    local LAN_IP
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
