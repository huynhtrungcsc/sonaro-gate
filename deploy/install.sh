#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Sonaro Gate • 2025.1 LTS  —  One-Command Installer
# ─────────────────────────────────────────────────────────────────────────────
# Copyright (c) 2025 Huỳnh Chí Trung (0xDragon) <huynhtrungcsc@gmail.com>
# SPDX-License-Identifier: MIT
# https://github.com/huynhtrungcsc/sonaro-gate
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
# $'...' C-style strings so \033 is interpreted as ESC, not literal backslash
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

# ── Docker Compose helper ──────────────────────────────────────────────────────
# IMPORTANT: Do NOT use --project-directory here.
#   --project-directory changes how Docker Compose resolves ALL relative paths
#   inside the compose file (context:, volume mounts, etc.).
#   The compose file uses "context: .." which is relative to its own location
#   (deploy/ → parent = /opt/sonaro). With --project-directory /opt/sonaro,
#   ".." would resolve to "/" (filesystem root) — wrong Dockerfile, build fails.
#
# Instead: use -f <absolute-path> + --env-file <absolute-path>.
#   -f with an absolute path makes Docker Compose resolve compose-file-relative
#   paths from the compose file's directory (deploy/) — so "context: .." → /opt/sonaro ✓
#   --env-file with an absolute path loads .env from the correct location ✓
DC="docker compose -f ${COMPOSE_FILE} --env-file ${INSTALL_DIR}/.env"

# ── UFW helper ────────────────────────────────────────────────────────────────
ufw_is_active() {
    command -v ufw &>/dev/null || return 1
    # Must match the FULL line "Status: active" — NOT "inactive" (which contains "active")
    ufw status 2>/dev/null | head -1 | grep -qx "Status: active"
}

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 1 — SYSTEM CHECK
# ─────────────────────────────────────────────────────────────────────────────
system_check() {
    step "Phase 1 — System check"

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

    # NICs
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

    # UFW — precise check
    echo ""
    echo -e "  ${BOLD}Host firewall (UFW)${RESET}"
    if command -v ufw &>/dev/null; then
        local ufw_line
        ufw_line=$(ufw status 2>/dev/null | head -1 || echo "Status: unknown")
        echo "    ${ufw_line}"
        if ufw_is_active; then
            warn "UFW is active — installer will open port ${PORT}/tcp automatically"
        else
            echo -e "    ${DIM}(UFW inactive — no rules to update)${RESET}"
        fi
    else
        echo -e "    ${DIM}UFW not installed${RESET}"
    fi

    # Port
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

    # Software — wireguard binary is `wg`, not `wireguard`
    echo ""
    echo -e "  ${BOLD}Installed software${RESET}"
    local -A TOOL_LABEL=( [wg]="wireguard" )
    for tool in docker git curl openssl node psql suricata wg; do
        local label="${TOOL_LABEL[$tool]:-$tool}"
        if command -v "$tool" &>/dev/null; then
            local ver
            ver=$("$tool" --version 2>/dev/null | head -1 | cut -c1-40 || echo "installed")
            echo -e "    ${GREEN}✓${RESET}  $(printf '%-16s' "$label")  ${DIM}${ver}${RESET}"
        else
            echo -e "    ${DIM}✗  $(printf '%-16s' "$label")  not installed${RESET}"
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
    if ufw_is_active; then
        info "UFW is ACTIVE — opening port ${_port}/tcp..."
        if ufw allow "${_port}/tcp" >/dev/null 2>&1; then
            ok "UFW: port ${_port}/tcp → ALLOW ✓"
            opened=1
        else
            warn "ufw allow command failed — try manually: sudo ufw allow ${_port}/tcp"
        fi
    fi

    # iptables — only add if INPUT policy is DROP/REJECT
    if command -v iptables &>/dev/null; then
        local _policy
        _policy=$(iptables -L INPUT -n 2>/dev/null \
            | awk '/^Chain INPUT/{match($0,/policy ([A-Z]+)/,a); print a[1]; exit}') \
            || _policy="UNKNOWN"
        [[ -z "$_policy" ]] && _policy="UNKNOWN"

        if [[ "$_policy" == "DROP" || "$_policy" == "REJECT" ]]; then
            info "iptables INPUT policy is ${_policy} — adding ACCEPT rule for port ${_port}/tcp"
            if ! iptables -C INPUT -p tcp --dport "${_port}" -j ACCEPT 2>/dev/null; then
                iptables -I INPUT -p tcp --dport "${_port}" -j ACCEPT 2>/dev/null \
                    && ok "iptables: ACCEPT tcp/${_port} added to INPUT chain" \
                    || warn "iptables insert failed — try: sudo iptables -I INPUT -p tcp --dport ${_port} -j ACCEPT"
            else
                ok "iptables: ACCEPT rule for tcp/${_port} already present"
            fi
            opened=1
        fi
    fi

    [[ "$opened" -eq 0 ]] && ok "Host firewall: port ${_port} accessible (no rule changes needed)"
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
        info "Non-interactive: clean wipe in 5 seconds... (Ctrl+C to cancel)"
        sleep 5
    fi

    _do_cleanup
}

_do_cleanup() {
    step "Cleaning up previous installation"

    # Use docker compose down -v to correctly remove compose-managed volumes
    # (volume names are prefixed with the project name, e.g. deploy_pgdata)
    if command -v docker &>/dev/null && [[ -f "$COMPOSE_FILE" ]]; then
        info "Stopping containers and removing volumes..."
        $DC down -v --remove-orphans 2>/dev/null || true
    fi

    # Belt-and-suspenders: remove containers by name if compose down didn't catch them
    docker rm -f sonaro-gate sonaro-db 2>/dev/null || true

    # Remove the image to force a full rebuild
    docker rmi sonaro-gate:latest 2>/dev/null || true

    # Systemd (native mode cleanup)
    systemctl stop sonaro-gate 2>/dev/null || true
    systemctl disable sonaro-gate 2>/dev/null || true
    rm -f /etc/systemd/system/sonaro-gate.service
    systemctl daemon-reload 2>/dev/null || true
    rm -f /etc/sysctl.d/99-sonaro.conf

    # Remove install directory
    if [[ -d "${INSTALL_DIR}" ]]; then
        info "Removing ${INSTALL_DIR}..."
        # cd away first — if the caller's CWD is inside INSTALL_DIR the shell
        # loses its working directory after rm -rf, breaking subsequent commands
        # (e.g. git clone fails with "Unable to read current working directory").
        cd /tmp || cd /
        rm -rf "${INSTALL_DIR}"
    fi

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
        echo ""
        echo -e "  ${BOLD}[2] Native${RESET}"
        echo -e "      • Installs Node.js 20 + PostgreSQL + Suricata directly on Ubuntu"
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

system_check
detect_and_clean

# ─────────────────────────────────────────────────────────────────────────────
# HELPER — Post-install diagnostic check
# ─────────────────────────────────────────────────────────────────────────────
run_post_diagnostics() {
    local _mode="$1"
    local _port="$2"

    step "Post-install diagnostics"

    if [[ "$_mode" == "docker" ]]; then
        echo -e "  ${BOLD}Container status:${RESET}"
        # $DC carries --project-directory so .env is auto-loaded
        $DC ps 2>/dev/null || {
            warn "docker compose ps failed — trying 'docker ps' directly..."
            docker ps --filter "name=sonaro" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || true
        }
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
        warn "The application did not bind to port ${_port}. Container logs:"

        if [[ "$_mode" == "docker" ]]; then
            # Use "docker logs <name>" directly — does NOT need env interpolation
            echo ""
            echo -e "${YELLOW}═══════════════ sonaro-gate (last 60 lines) ════════════════${RESET}"
            docker logs sonaro-gate --tail=60 2>&1 || \
                echo "  (container 'sonaro-gate' not found — check: docker ps -a)"
            echo -e "${YELLOW}═══════════════════════════════════════════════════════════${RESET}"
            echo ""
            echo -e "${YELLOW}════════════════ sonaro-db (last 20 lines) ════════════════${RESET}"
            docker logs sonaro-db --tail=20 2>&1 || \
                echo "  (container 'sonaro-db' not found)"
            echo -e "${YELLOW}═══════════════════════════════════════════════════════════${RESET}"
        else
            journalctl -u sonaro-gate -n 50 --no-pager 2>/dev/null || true
        fi
    fi

    echo ""
    echo -e "  ${BOLD}UFW rules:${RESET}"
    if command -v ufw &>/dev/null && ufw_is_active; then
        ufw status numbered 2>/dev/null | grep -E "${_port}" || echo "    (no rule found for port ${_port})"
    else
        echo "    UFW is inactive — no host firewall blocking the port"
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# HELPER — Print detailed post-install guide
# ─────────────────────────────────────────────────────────────────────────────
print_post_install_guide() {
    local _mode="$1"
    local _port="$2"
    local _lan_ip="$3"

    # The canonical docker compose command prefix to show users
    local SHOW_DC="docker compose -f ${COMPOSE_FILE} --env-file ${INSTALL_DIR}/.env"

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

    # ① Access
    hdr "  ① Access the web interface"
    sep
    echo -e "  Open a browser on any device on the same network:\n"
    echo -e "    ${BOLD}${CYAN}http://${_lan_ip}:${_port}${RESET}\n"
    echo -e "    Email:     ${BOLD}admin@sonaro.local${RESET}"
    echo -e "    Password:  ${BOLD}Admin123!${RESET}"
    echo ""
    echo -e "  ${YELLOW}  ⚠  Change the password immediately after first login!${RESET}"
    echo -e "  ${DIM}     System → Administrators → Click admin → Change Password${RESET}"

    # ② Network interfaces
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

    # ③ Verify
    echo ""
    hdr "  ③ Verify the application is running"
    sep
    if [[ "$_mode" == "docker" ]]; then
        echo -e "  ${DIM}Container status:${RESET}"
        echo -e "    ${CYAN}${SHOW_DC} ps${RESET}"
        echo ""
        echo -e "  ${DIM}Live application logs:${RESET}"
        echo -e "    ${CYAN}docker logs sonaro-gate -f${RESET}"
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

    # ④ Security checklist
    echo ""
    hdr "  ④ Security checklist  (do these right after first login)"
    sep
    echo -e "  ${DIM}☐${RESET}  Change admin password          ${DIM}→ System → Administrators → Edit${RESET}"
    echo -e "  ${DIM}☐${RESET}  Set hostname and timezone      ${DIM}→ System → Settings${RESET}"
    echo -e "  ${DIM}☐${RESET}  Review default firewall policy ${DIM}→ Firewall → Policy & Objects${RESET}"
    echo -e "  ${DIM}☐${RESET}  Assign WAN and LAN interfaces  ${DIM}→ Network → Interfaces${RESET}"
    echo -e "  ${DIM}☐${RESET}  Enable IDS/IPS                 ${DIM}→ Security → IDS/IPS${RESET}"

    # ⑤ Management commands
    echo ""
    hdr "  ⑤ Management commands"
    sep
    if [[ "$_mode" == "docker" ]]; then
        echo -e "  ${DIM}Status:${RESET}      ${CYAN}${SHOW_DC} ps${RESET}"
        echo -e "  ${DIM}Start:${RESET}       ${CYAN}${SHOW_DC} up -d${RESET}"
        echo -e "  ${DIM}Stop:${RESET}        ${CYAN}${SHOW_DC} down${RESET}"
        echo -e "  ${DIM}Restart:${RESET}     ${CYAN}${SHOW_DC} restart${RESET}"
        echo -e "  ${DIM}App logs:${RESET}    ${CYAN}docker logs sonaro-gate -f${RESET}"
        echo -e "  ${DIM}DB logs:${RESET}     ${CYAN}docker logs sonaro-db -f${RESET}"
        echo -e "  ${DIM}Shell:${RESET}       ${CYAN}docker exec -it sonaro-gate bash${RESET}"
        echo ""
        echo -e "  ${DIM}Update to latest:${RESET}"
        echo -e "    ${CYAN}git -C ${INSTALL_DIR} pull && ${SHOW_DC} up -d --build${RESET}"
    else
        echo -e "  ${DIM}Status:${RESET}  ${CYAN}systemctl status sonaro-gate${RESET}"
        echo -e "  ${DIM}Start:${RESET}   ${CYAN}systemctl start sonaro-gate${RESET}"
        echo -e "  ${DIM}Stop:${RESET}    ${CYAN}systemctl stop sonaro-gate${RESET}"
        echo -e "  ${DIM}Restart:${RESET} ${CYAN}systemctl restart sonaro-gate${RESET}"
        echo -e "  ${DIM}Logs:${RESET}    ${CYAN}journalctl -u sonaro-gate -f${RESET}"
    fi

    # ⑥ File locations
    echo ""
    hdr "  ⑥ Important file locations"
    sep
    echo -e "  ${DIM}Install dir:${RESET}   ${INSTALL_DIR}"
    echo -e "  ${DIM}Config (.env):${RESET} ${INSTALL_DIR}/.env   ${YELLOW}← keep private! contains passwords${RESET}"
    if [[ "$_mode" == "docker" ]]; then
        echo -e "  ${DIM}DB data:${RESET}       Docker volume  ${CYAN}(${INSTALL_DIR##*/}_pgdata or deploy_pgdata)${RESET}"
        echo -e "  ${DIM}Compose file:${RESET}  ${COMPOSE_FILE}"
    else
        echo -e "  ${DIM}DB data:${RESET}       /var/lib/postgresql/"
        echo -e "  ${DIM}Service:${RESET}       /etc/systemd/system/sonaro-gate.service"
    fi

    # ⑦ Troubleshooting
    echo ""
    hdr "  ⑦ Cannot access the web UI? — try these steps in order"
    sep
    echo -e "  ${BOLD}  1. Is the app running?${RESET}"
    if [[ "$_mode" == "docker" ]]; then
        echo -e "     ${CYAN}docker ps --filter name=sonaro${RESET}"
    else
        echo -e "     ${CYAN}systemctl status sonaro-gate${RESET}"
    fi
    echo ""
    echo -e "  ${BOLD}  2. Is the port listening?${RESET}"
    echo -e "     ${CYAN}ss -tlnp | grep ${_port}${RESET}"
    echo -e "     ${DIM}     → Should show LISTEN on 0.0.0.0:${_port}${RESET}"
    echo ""
    echo -e "  ${BOLD}  3. Is UFW blocking the port?${RESET}"
    echo -e "     ${CYAN}sudo ufw status numbered${RESET}"
    echo -e "     ${CYAN}sudo ufw allow ${_port}/tcp${RESET}    ${DIM}← run this if ${_port} is not listed${RESET}"
    echo ""
    echo -e "  ${BOLD}  4. View app logs${RESET}"
    if [[ "$_mode" == "docker" ]]; then
        echo -e "     ${CYAN}docker logs sonaro-gate --tail=50${RESET}"
    fi
    echo ""
    echo -e "  ${BOLD}  5. Test locally on the server${RESET}"
    echo -e "     ${CYAN}curl http://127.0.0.1:${_port}/api/health${RESET}"
    echo -e "     ${DIM}     → Should return: {\"status\":\"ok\"}${RESET}"
    echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# SHARED — Host network stack (runs in BOTH docker and native modes)
# Installs WireGuard, Suricata, OpenVPN, enables IP forwarding, loads kernel
# modules, and downloads the latest IDS/IPS threat signatures.
# The Docker app container (privileged + host network) talks directly to these
# host-level services, so they must be present regardless of install method.
# ─────────────────────────────────────────────────────────────────────────────
install_host_network_stack() {
    local _step="$1"   # e.g. "Step 3/7"

    step "${_step} — Host network stack (VPN, IDS/IPS, IP forwarding)"
    export DEBIAN_FRONTEND=noninteractive

    # ── Core networking tools ──────────────────────────────────────────────────
    info "Installing core networking packages..."
    apt-get update -qq
    apt-get install -y -qq \
        iproute2 \
        iptables \
        iptables-persistent \
        netfilter-persistent \
        ipset \
        nftables \
        conntrack \
        tcpdump \
        openssl \
        jq 2>/dev/null || true
    ok "Core networking tools installed"

    # ── WireGuard VPN ─────────────────────────────────────────────────────────
    info "Installing WireGuard VPN..."
    apt-get install -y -qq wireguard wireguard-tools

    # Create WireGuard config directory with strict permissions
    mkdir -p /etc/wireguard
    chmod 700 /etc/wireguard

    # Load the kernel module
    if modprobe wireguard 2>/dev/null; then
        ok "WireGuard kernel module loaded"
    else
        warn "WireGuard module load failed — trying wireguard-dkms..."
        apt-get install -y -qq wireguard-dkms 2>/dev/null || true
        modprobe wireguard 2>/dev/null || warn "WireGuard module still unavailable (check kernel headers)"
    fi

    # Verify WireGuard crypto by generating and validating a test key pair
    # This confirms the kernel module is fully functional, not just installed
    local _wg_privkey _wg_pubkey
    _wg_privkey=$(wg genkey 2>/dev/null || true)
    _wg_pubkey=$(echo "$_wg_privkey" | wg pubkey 2>/dev/null || true)
    if [[ ${#_wg_pubkey} -eq 44 ]]; then
        ok "WireGuard crypto verified — key generation works ✓"
        ok "  Version: $(wg --version 2>/dev/null | head -1 || echo 'installed')"
    else
        warn "WireGuard key generation failed — kernel module may not be active"
        warn "  Fix: sudo modprobe wireguard && wg genkey | wg pubkey"
    fi

    # ── OpenVPN ───────────────────────────────────────────────────────────────
    info "Installing OpenVPN..."
    if apt-get install -y -qq openvpn easy-rsa 2>/dev/null; then
        mkdir -p /etc/openvpn/server /etc/openvpn/client /etc/openvpn/pki
        # EasyRSA for PKI management
        if command -v make-cadir &>/dev/null; then
            [[ ! -d /etc/openvpn/easy-rsa ]] && make-cadir /etc/openvpn/easy-rsa 2>/dev/null || true
        fi
        # Stop the default OpenVPN service — Sonaro Gate manages the process
        systemctl disable --now openvpn 2>/dev/null || true
        local _ovpn_ver
        _ovpn_ver=$(openvpn --version 2>/dev/null | head -1 | awk '{print $2}' || echo 'installed')
        ok "OpenVPN installed (${_ovpn_ver}) — PKI dirs created at /etc/openvpn/"
    else
        warn "OpenVPN not available in repository — skipping (optional feature)"
    fi

    # ── Suricata IDS/IPS ──────────────────────────────────────────────────────
    info "Installing Suricata IDS/IPS engine..."
    apt-get install -y -qq suricata suricata-update

    # Create directory structure
    mkdir -p /etc/suricata/rules /var/log/suricata /var/lib/suricata/rules
    touch /etc/suricata/rules/sonaro-local.rules

    # ── Suricata configuration ─────────────────────────────────────────────────
    info "Configuring Suricata IDS/IPS..."

    # Detect primary WAN interface (default route)
    local _wan_iface
    _wan_iface=$(ip route get 8.8.8.8 2>/dev/null | grep -oP 'dev \K\S+' | head -1 || echo "eth0")

    # Detect all local subnets for HOME_NET
    local _home_net
    _home_net=$(ip -4 addr show scope global 2>/dev/null \
        | grep -oP '(?<=inet )\S+' | paste -sd ',' | sed 's/,$//')
    [[ -z "$_home_net" ]] && _home_net="192.168.0.0/16,10.0.0.0/8,172.16.0.0/12"

    if [[ -f /etc/suricata/suricata.yaml ]]; then
        # Set HOME_NET to detected local subnets
        sed -i "s|HOME_NET: \"[^\"]*\"|HOME_NET: \"[$_home_net]\"|" \
            /etc/suricata/suricata.yaml 2>/dev/null || true

        # Point default-rule-path to where suricata-update writes rules
        sed -i "s|default-rule-path:.*|default-rule-path: /var/lib/suricata/rules|" \
            /etc/suricata/suricata.yaml 2>/dev/null || true

        # Ensure the local rules file is included
        if ! grep -q "sonaro-local.rules" /etc/suricata/suricata.yaml 2>/dev/null; then
            sed -i "/rule-files:/a\\  - /etc/suricata/rules/sonaro-local.rules" \
                /etc/suricata/suricata.yaml 2>/dev/null || true
        fi

        ok "Suricata configured (WAN interface: ${_wan_iface}, HOME_NET: ${_home_net})"
    else
        warn "suricata.yaml not found at /etc/suricata/ — config may need manual review"
    fi

    # Enable the Emerging Threats Open ruleset explicitly (most common free source)
    info "Adding Emerging Threats Open ruleset source..."
    suricata-update add-source et/open \
        "https://rules.emergingthreats.net/open/suricata-%(__version__)s/emerging.rules.tar.gz" \
        2>/dev/null || true  # Already added on repeat runs — ignore error

    # Download/update signatures
    info "Downloading IDS/IPS threat signatures (Emerging Threats Open)..."
    if suricata-update --no-reload 2>/dev/null; then
        local _sig_count
        _sig_count=$(grep -c "^alert" /var/lib/suricata/rules/suricata.rules 2>/dev/null || echo "?")
        ok "Suricata signatures updated — ${_sig_count} rules ready"
    else
        warn "suricata-update failed — run manually: sudo suricata-update"
    fi

    # Validate configuration (--simulate-test so no live interface needed)
    info "Validating Suricata configuration..."
    local _suricata_ok=0
    if suricata -T -c /etc/suricata/suricata.yaml >/tmp/suricata-test.log 2>&1; then
        ok "Suricata config validation passed ✓"
        _suricata_ok=1
    else
        warn "Suricata config test reported warnings (see /tmp/suricata-test.log):"
        grep -E "Error|error|failed" /tmp/suricata-test.log 2>/dev/null | head -5 | \
            while IFS= read -r line; do warn "  $line"; done
        warn "  Suricata will still start — review /etc/suricata/suricata.yaml if issues occur"
    fi

    # Disable the default Suricata systemd service — Sonaro Gate manages it via API
    systemctl disable --now suricata 2>/dev/null || true
    ok "Suricata IDS/IPS installed and ready (managed by Sonaro Gate web UI)"

    # ── dnsmasq (internal DNS/DHCP for VPN clients) ────────────────────────────
    if apt-get install -y -qq dnsmasq 2>/dev/null; then
        systemctl disable --now dnsmasq 2>/dev/null || true
        ok "dnsmasq installed (managed by Sonaro Gate)"
    fi

    # ── Kernel: IP forwarding + connection tracking ────────────────────────────
    info "Configuring kernel for firewall operation..."

    # Apply immediately
    sysctl -w net.ipv4.ip_forward=1                                    >/dev/null 2>&1
    sysctl -w net.ipv6.conf.all.forwarding=1                           >/dev/null 2>&1
    sysctl -w net.ipv4.conf.all.rp_filter=0                            >/dev/null 2>&1
    sysctl -w net.ipv4.conf.default.rp_filter=0                        >/dev/null 2>&1
    sysctl -w net.netfilter.nf_conntrack_max=1048576                   >/dev/null 2>&1 || true
    sysctl -w net.netfilter.nf_conntrack_tcp_timeout_established=3600  >/dev/null 2>&1 || true

    # Persist across reboots
    cat > /etc/sysctl.d/99-sonaro.conf <<'SYSCTL'
# ── Sonaro Gate — kernel network settings ────────────────────────────────────
# IP Forwarding (required for routing between interfaces)
net.ipv4.ip_forward=1
net.ipv6.conf.all.forwarding=1

# Disable reverse path filtering (needed for asymmetric routing on a firewall)
net.ipv4.conf.all.rp_filter=0
net.ipv4.conf.default.rp_filter=0

# Connection tracking (supports up to 1M concurrent sessions)
net.netfilter.nf_conntrack_max=1048576
net.netfilter.nf_conntrack_tcp_timeout_established=3600
net.netfilter.nf_conntrack_udp_timeout=60
net.netfilter.nf_conntrack_udp_timeout_stream=120

# Network buffer tuning for high-throughput firewall
net.core.rmem_max=16777216
net.core.wmem_max=16777216
net.ipv4.tcp_rmem=4096 87380 16777216
net.ipv4.tcp_wmem=4096 65536 16777216
SYSCTL

    sysctl -p /etc/sysctl.d/99-sonaro.conf >/dev/null 2>&1
    ok "IP forwarding and connection tracking configured"

    # ── Load kernel modules ────────────────────────────────────────────────────
    info "Loading required kernel modules..."
    local _loaded=0 _failed=0
    for _mod in nf_conntrack nf_nat ip_tables ip6_tables \
                xt_state xt_conntrack xt_MASQUERADE xt_REDIRECT \
                xt_tcpudp xt_limit xt_LOG \
                wireguard tun; do
        if modprobe "$_mod" 2>/dev/null; then
            _loaded=$(( _loaded + 1 ))
        else
            _failed=$(( _failed + 1 ))
        fi
    done
    ok "Kernel modules loaded (${_loaded} ok, ${_failed} skipped — normal on VMs)"

    # Persist modules across reboots
    cat > /etc/modules-load.d/sonaro.conf <<'MODULES'
# Sonaro Gate — kernel modules loaded at boot
nf_conntrack
nf_nat
ip_tables
ip6_tables
xt_state
xt_conntrack
xt_MASQUERADE
wireguard
tun
MODULES

    # ── Component verification summary ────────────────────────────────────────
    verify_host_network_stack
}

# ─────────────────────────────────────────────────────────────────────────────
# SHARED — Verify host network stack components and print status table
# ─────────────────────────────────────────────────────────────────────────────
verify_host_network_stack() {
    echo ""
    echo -e "${BOLD}${CYAN}  ┌─────────────────────────────────────────────────────────────┐${RESET}"
    echo -e "${BOLD}${CYAN}  │   Host Network Stack — Component Verification               │${RESET}"
    echo -e "${BOLD}${CYAN}  └─────────────────────────────────────────────────────────────┘${RESET}"
    echo ""

    local _ok="${GREEN}✓${RESET}"
    local _warn="${YELLOW}⚠${RESET}"
    local _fail="${RED}✗${RESET}"

    # Helper: print one status row
    _row() {
        local _icon="$1" _name="$2" _detail="$3"
        printf "  %b  %-22s %s\n" "$_icon" "$_name" "$_detail"
    }

    # ── IP Forwarding ─────────────────────────────────────────────────────────
    local _fwd
    _fwd=$(cat /proc/sys/net/ipv4/ip_forward 2>/dev/null || echo "0")
    if [[ "$_fwd" == "1" ]]; then
        _row "$_ok" "IP Forwarding" "enabled (net.ipv4.ip_forward=1)"
    else
        _row "$_fail" "IP Forwarding" "DISABLED — run: sysctl -w net.ipv4.ip_forward=1"
    fi

    # ── iptables ──────────────────────────────────────────────────────────────
    if command -v iptables &>/dev/null; then
        local _ipt_ver
        _ipt_ver=$(iptables --version 2>/dev/null | head -1 | awk '{print $2}' || echo "?")
        _row "$_ok" "iptables" "${_ipt_ver}"
    else
        _row "$_fail" "iptables" "not found"
    fi

    # ── nf_conntrack kernel module ────────────────────────────────────────────
    if lsmod 2>/dev/null | grep -q "nf_conntrack"; then
        local _ct_max
        _ct_max=$(cat /proc/sys/net/netfilter/nf_conntrack_max 2>/dev/null || echo "?")
        _row "$_ok" "nf_conntrack" "loaded (max: ${_ct_max} sessions)"
    else
        _row "$_warn" "nf_conntrack" "not loaded — try: modprobe nf_conntrack"
    fi

    # ── WireGuard ─────────────────────────────────────────────────────────────
    local _wg_mod=0
    lsmod 2>/dev/null | grep -q "wireguard" && _wg_mod=1
    local _wg_bin=0
    command -v wg &>/dev/null && _wg_bin=1
    # Key generation test (definitive functional check)
    local _wg_key
    _wg_key=$(wg genkey 2>/dev/null | wg pubkey 2>/dev/null || true)
    if [[ ${#_wg_key} -eq 44 ]]; then
        local _wg_ver
        _wg_ver=$(wg --version 2>/dev/null | head -1 || echo "wireguard-tools")
        _row "$_ok" "WireGuard VPN" "${_wg_ver} — key crypto verified ✓"
    elif [[ $_wg_bin -eq 1 ]]; then
        _row "$_warn" "WireGuard VPN" "binary present but crypto test failed — check kernel module"
        _row ""      "  → Fix"       "sudo modprobe wireguard"
    else
        _row "$_fail" "WireGuard VPN" "not installed"
        _row ""       "  → Fix"      "sudo apt-get install -y wireguard wireguard-tools"
    fi

    # ── OpenVPN ───────────────────────────────────────────────────────────────
    if command -v openvpn &>/dev/null; then
        local _ovpn_ver
        _ovpn_ver=$(openvpn --version 2>/dev/null | head -1 | awk '{print $2}' || echo "installed")
        _row "$_ok" "OpenVPN" "${_ovpn_ver}"
    else
        _row "$_warn" "OpenVPN" "not installed (optional — install: apt-get install openvpn)"
    fi

    # ── Suricata ──────────────────────────────────────────────────────────────
    if command -v suricata &>/dev/null; then
        local _sur_ver
        _sur_ver=$(suricata --build-info 2>/dev/null | grep "^Version" | awk '{print $2}' \
            || suricata -V 2>/dev/null | grep -oP 'version \K\S+' || echo "installed")
        local _rules_file="/var/lib/suricata/rules/suricata.rules"
        if [[ -f "$_rules_file" ]]; then
            local _rule_count
            _rule_count=$(grep -c "^alert" "$_rules_file" 2>/dev/null || echo "0")
            # Test config
            if suricata -T -c /etc/suricata/suricata.yaml >/dev/null 2>&1; then
                _row "$_ok" "Suricata IDS/IPS" "${_sur_ver} — ${_rule_count} rules — config OK ✓"
            else
                _row "$_warn" "Suricata IDS/IPS" "${_sur_ver} — ${_rule_count} rules — config has warnings"
                _row ""       "  → Check"       "suricata -T -c /etc/suricata/suricata.yaml"
            fi
        else
            _row "$_warn" "Suricata IDS/IPS" "${_sur_ver} — no rule file (run: sudo suricata-update)"
        fi
    else
        _row "$_fail" "Suricata IDS/IPS" "not installed"
    fi

    # ── dnsmasq ───────────────────────────────────────────────────────────────
    if command -v dnsmasq &>/dev/null; then
        local _dm_ver
        _dm_ver=$(dnsmasq --version 2>/dev/null | head -1 | awk '{print $3}' || echo "installed")
        _row "$_ok" "dnsmasq" "${_dm_ver} (managed by Sonaro Gate)"
    else
        _row "$_warn" "dnsmasq" "not installed (optional — install: apt-get install dnsmasq)"
    fi

    echo ""
    echo -e "  ${DIM}Note: Suricata and OpenVPN services are intentionally DISABLED at boot.${RESET}"
    echo -e "  ${DIM}They are started/stopped by Sonaro Gate via the web UI (Security → IDS/IPS,${RESET}"
    echo -e "  ${DIM}VPN → Tunnels). Do NOT enable them manually with systemctl.${RESET}"
    echo ""
}


# ─────────────────────────────────────────────────────────────────────────────
# DOCKER INSTALL
# ─────────────────────────────────────────────────────────────────────────────
install_docker_mode() {

    # ── Step 1: Docker Engine ─────────────────────────────────────────────────
    step "Step 1/7 — Docker Engine"

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
    step "Step 2/7 — Download source"
    apt-get install -y -qq git 2>/dev/null || true
    info "Cloning repository..."
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
    ok "Source ready at ${INSTALL_DIR}"

    # ── Step 3: Host network stack ─────────────────────────────────────────────
    # Install WireGuard, OpenVPN, Suricata on the HOST — the privileged Docker
    # container reaches these via the host network and host filesystem mounts.
    install_host_network_stack "Step 3/7"

    # ── Step 4: Write .env ────────────────────────────────────────────────────
    step "Step 4/7 — Environment configuration"

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

    # ── Step 5: Open firewall ports ────────────────────────────────────────────
    step "Step 5/7 — Opening firewall port ${PORT}"
    open_firewall_ports "$PORT"

    # ── Step 6: Build and start ────────────────────────────────────────────────
    step "Step 6/7 — Build Docker image and start containers"

    info "Building Docker image (compiles TypeScript + React frontend)..."
    info "First run takes 3–5 minutes — please wait..."
    # Redirect stdin from /dev/null to prevent Docker BuildKit (docker buildx bake)
    # from consuming the curl|bash pipe. Without this, BuildKit reads the remaining
    # bash script content as bake definitions (478 bytes) and the Dockerfile transfer
    # gets 0–2 bytes → "failed to read dockerfile: no such file or directory".
    # NOTE: exec 0</dev/null at the top of the script would break curl|bash entirely
    # (curl gets SIGPIPE). Per-command redirection is the correct solution.
    $DC build </dev/null

    info "Starting containers (PostgreSQL + Sonaro Gate)..."
    $DC up -d </dev/null
    ok "Containers started"

    # ── Step 7: Health check ───────────────────────────────────────────────────
    step "Step 7/7 — Waiting for application to become ready"
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
        warn "Health check timed out — showing container logs to diagnose:"
        echo ""
        echo -e "${YELLOW}═══════════════ sonaro-gate (last 60 lines) ════════════════${RESET}"
        # Use "docker logs" directly — no env interpolation needed, always works
        docker logs sonaro-gate --tail=60 2>&1 || echo "  (container not found — it may have crashed)"
        echo -e "${YELLOW}═══════════════════════════════════════════════════════════${RESET}"
        echo ""
        echo -e "${YELLOW}════════════════ sonaro-db (last 20 lines) ════════════════${RESET}"
        docker logs sonaro-db --tail=20 2>&1 || echo "  (container not found)"
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

    # ── Step 1: Host network stack (WireGuard, OpenVPN, Suricata, IP forwarding)
    install_host_network_stack "Step 1/7"

    # ── Step 2: Extra native-mode system packages ──────────────────────────────
    step "Step 2/7 — System packages (PostgreSQL, Node.js runtime)"
    apt-get install -y -qq \
        curl wget gnupg ca-certificates lsb-release \
        netplan.io postgresql postgresql-client \
        git build-essential
    ok "System packages installed"

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

    step "Step 4/7 — PostgreSQL database"
    systemctl enable --now postgresql
    sleep 2
    sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" 2>/dev/null \
        || sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" 2>/dev/null || true
    ok "Database ${DB_NAME} ready"

    step "Step 5/7 — Configuration and database schema"
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

    step "Step 6/7 — Opening firewall port and starting service"
    open_firewall_ports "$PORT"

    cp "${INSTALL_DIR}/deploy/sonaro-gate.service" /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable sonaro-gate
    systemctl start sonaro-gate
    sleep 3
    ok "sonaro-gate.service started and enabled on boot"

    step "Step 7/7 — Waiting for application to become ready"
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
        warn "Health check timed out — showing service logs to diagnose:"
        echo ""
        echo -e "${YELLOW}═══════════════ sonaro-gate (last 60 lines) ════════════════${RESET}"
        journalctl -u sonaro-gate -n 60 --no-pager 2>/dev/null || \
            echo "  (service logs not available)"
        echo -e "${YELLOW}═══════════════════════════════════════════════════════════${RESET}"
    fi

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
