#!/usr/bin/env bash
# =============================================================================
# Sonaro Gate — Console Menu (pfSense-style)
# Installed at: /usr/local/bin/sonaro-console
# Usage:        sonaro-console   (run as root or with sudo)
# =============================================================================

set -eu

# ── Colour helpers ────────────────────────────────────────────────────────────
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'
BOLD=$'\033[1m'
DIM=$'\033[2m'
RESET=$'\033[0m'

INSTALL_DIR="${INSTALL_DIR:-/opt/sonaro}"
PORT="${PORT:-5000}"
ENV_FILE="${INSTALL_DIR}/.env"

# ── Root guard ────────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    echo ""
    echo -e "${YELLOW}  This menu requires root privileges.${RESET}"
    echo -e "  Re-launching with sudo..."
    echo ""
    exec sudo "$0" "$@"
fi

# ── Helpers ───────────────────────────────────────────────────────────────────
ok()   { echo -e "  ${GREEN}[  OK ]${RESET}  $*"; }
warn() { echo -e "  ${YELLOW}[ WARN]${RESET}  $*"; }
info() { echo -e "  ${CYAN}[INFO]${RESET}  $*"; }
err()  { echo -e "  ${RED}[ERROR]${RESET}  $*"; }

press_enter() { read -rp "  Press Enter to return to menu..." _DUMMY < /dev/tty; }

# ── Detect install mode ───────────────────────────────────────────────────────
detect_mode() {
    if docker ps 2>/dev/null | grep -q "sonaro"; then
        echo "docker"
    elif systemctl is-active --quiet sonaro-gate 2>/dev/null; then
        echo "native"
    else
        echo "unknown"
    fi
}

# ── Get interface status from OS ──────────────────────────────────────────────
get_iface_line() {
    local iface="$1" role="$2"
    local state ip
    state=$(ip -o link show "$iface" 2>/dev/null | grep -oP '(?<=state )\S+' || echo "?")
    ip=$(ip -4 addr show "$iface" 2>/dev/null | grep -oP '(?<=inet )\S+' | head -1 || true)
    [[ -z "$ip" ]] && ip="(no IP)"
    echo "${role} (${iface})  -->  ${ip}  [${state}]"
}

get_wan_iface() {
    # Try loading from .env first, then fall back to routing heuristics
    local _w=""
    [[ -f "$ENV_FILE" ]] && _w=$(grep -oP '(?<=WAN_INTERFACE=)\S+' "$ENV_FILE" 2>/dev/null || true)
    if [[ -z "$_w" ]]; then
        # Interface with default route
        _w=$(ip route show default 2>/dev/null | awk '/^default/{print $5; exit}')
    fi
    echo "${_w:-ens33}"
}

get_lan_iface() {
    local _l=""
    [[ -f "$ENV_FILE" ]] && _l=$(grep -oP '(?<=LAN_INTERFACE=)\S+' "$ENV_FILE" 2>/dev/null || true)
    if [[ -z "$_l" ]]; then
        # Auto-detect: first physical interface that is UP, has an IP,
        # is not the WAN interface, and is not a virtual/docker bridge.
        local _wan
        _wan=$(get_wan_iface)
        while IFS= read -r _line; do
            local _ifc
            _ifc=$(echo "$_line" | awk -F': ' '{print $2}' | sed 's/@.*//')
            [[ "$_ifc" == "lo" ]]    && continue
            [[ "$_ifc" == "$_wan" ]] && continue
            [[ "$_ifc" =~ ^(docker|br-|veth|virbr|vmnet|bond|dummy|tun|tap) ]] && continue
            local _addr
            _addr=$(ip -4 addr show "$_ifc" 2>/dev/null | grep -oP '(?<=inet )\S+' | head -1 || true)
            [[ -z "$_addr" ]] && continue
            _l="$_ifc"
            break
        done < <(ip -o link show 2>/dev/null | grep -v '^[0-9]*: lo')
    fi
    echo "${_l:-}"
}

get_lan_ip() {
    local _lan
    _lan=$(get_lan_iface)
    if [[ -n "$_lan" ]]; then
        ip -4 addr show "$_lan" 2>/dev/null | grep -oP '(?<=inet )\d+\.\d+\.\d+\.\d+' | head -1 || true
    fi
}

get_hostname() {
    hostname 2>/dev/null || cat /etc/hostname 2>/dev/null || echo "sonaro-gw"
}

# ── Print header ──────────────────────────────────────────────────────────────
print_header() {
    local wan lan_ip hostname
    wan=$(get_wan_iface)
    hostname=$(get_hostname)

    printf '\033c'   # clear screen

    local LINE
    LINE=$(printf '%0.s=' {1..64})
    echo -e "${BOLD}${CYAN}${LINE}${RESET}"
    printf "${BOLD}${CYAN}%*s${RESET}\n" $(( (64 + ${#hostname} + 34) / 2 )) \
        "*** Welcome to Sonaro Gate 2025.1 on ${hostname} ***"
    echo -e "${BOLD}${CYAN}${LINE}${RESET}"
    echo ""
    echo -e "  $(get_iface_line "$wan" " WAN")"
    local lan
    lan=$(get_lan_iface)
    if [[ -n "$lan" ]]; then
        echo -e "  $(get_iface_line "$lan" " LAN")"
    else
        echo -e "   LAN  -->  (not configured)"
    fi
    echo ""
    lan_ip=$(get_lan_ip)
    if [[ -n "$lan_ip" ]]; then
        echo -e "  ${DIM}Access the web console at:${RESET}"
        echo -e "    ${BOLD}${CYAN}http://${lan_ip}:${PORT}${RESET}"
        echo ""
    fi
    local SEP
    SEP=$(printf '%0.s-' {1..64})
    echo -e "${DIM}${SEP}${RESET}"
    echo ""
    echo -e "   ${BOLD}0)${RESET} Logout / Disconnect SSH     ${BOLD}7)${RESET} Ping host"
    echo -e "   ${BOLD}1)${RESET} Assign Interfaces           ${BOLD}8)${RESET} Shell"
    echo -e "   ${BOLD}2)${RESET} Set interface(s) IP address ${BOLD}9)${RESET} Restart Sonaro Gate"
    echo -e "   ${BOLD}3)${RESET} Reset admin password       ${BOLD}10)${RESET} Show management URL"
    echo -e "   ${BOLD}4)${RESET} Reboot system              ${BOLD}11)${RESET} System information"
    echo -e "   ${BOLD}5)${RESET} Halt system                ${BOLD}12)${RESET} Show routing table"
    echo -e "   ${BOLD}6)${RESET} View logs                  ${BOLD}13)${RESET} Show active connections"
    echo ""
    echo -e "${DIM}${SEP}${RESET}"
    echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Option 1 — Assign Interfaces
# ─────────────────────────────────────────────────────────────────────────────
menu_assign_interfaces() {
    echo ""
    echo -e "${BOLD}  Assign Interfaces${RESET}"
    echo ""

    local ifaces=()
    while IFS= read -r line; do
        local iface
        iface=$(echo "$line" | awk -F': ' '{print $2}' | sed 's/@.*//')
        [[ "$iface" == "lo" ]] && continue
        ifaces+=("$iface")
    done < <(ip -o link show 2>/dev/null | grep -v '^[0-9]*: lo')

    if [[ "${#ifaces[@]}" -eq 0 ]]; then
        warn "No network interfaces detected."; press_enter; return
    fi

    local SEP="  ──────────────────────────────────────────────────────"
    echo -e "  ${BOLD}Available interfaces:${RESET}"
    echo "$SEP"
    local idx=1
    for ifc in "${ifaces[@]}"; do
        local state addr
        state=$(ip -o link show "$ifc" 2>/dev/null | grep -oP '(?<=state )\S+' || echo "?")
        addr=$(ip -4 addr show "$ifc" 2>/dev/null | grep -oP '(?<=inet )\S+' | head -1 || true)
        [[ -z "$addr" ]] && addr="(no IP)"
        printf "    [%d] %-14s  %-8s  %s\n" "$idx" "$ifc" "$state" "$addr"
        idx=$(( idx + 1 ))
    done
    echo "$SEP"
    echo ""

    # WAN
    local wan_idx
    read -rp "  Select WAN interface [1]: " wan_idx < /dev/tty
    wan_idx="${wan_idx:-1}"
    [[ ! "$wan_idx" =~ ^[0-9]+$ ]] || (( wan_idx < 1 || wan_idx > ${#ifaces[@]} )) && {
        warn "Invalid selection."; press_enter; return
    }
    local new_wan="${ifaces[$(( wan_idx - 1 ))]}"

    # LAN
    local lan_choices=()
    for ifc in "${ifaces[@]}"; do
        [[ "$ifc" == "$new_wan" ]] && continue
        lan_choices+=("$ifc")
    done

    local new_lan=""
    if [[ "${#lan_choices[@]}" -gt 0 ]]; then
        echo ""
        echo -e "  ${BOLD}Available LAN interfaces:${RESET}"
        echo "$SEP"
        local lidx=1
        for ifc in "${lan_choices[@]}"; do
            local st ad
            st=$(ip -o link show "$ifc" 2>/dev/null | grep -oP '(?<=state )\S+' || echo "?")
            ad=$(ip -4 addr show "$ifc" 2>/dev/null | grep -oP '(?<=inet )\S+' | head -1 || true)
            [[ -z "$ad" ]] && ad="(no IP)"
            printf "    [%d] %-14s  %-8s  %s\n" "$lidx" "$ifc" "$st" "$ad"
            lidx=$(( lidx + 1 ))
        done
        echo "$SEP"
        echo ""
        local lan_idx
        read -rp "  Select LAN interface [1]: " lan_idx < /dev/tty
        lan_idx="${lan_idx:-1}"
        new_lan="${lan_choices[$(( lan_idx - 1 ))]}"
    fi

    echo ""
    echo -e "  WAN --> ${BOLD}${new_wan}${RESET}"
    [[ -n "$new_lan" ]] && echo -e "  LAN --> ${BOLD}${new_lan}${RESET}"
    echo ""
    read -rp "  Save this assignment? [Y/n]: " _CONF < /dev/tty
    _CONF="${_CONF:-Y}"
    if [[ "${_CONF,,}" =~ ^(y|yes)$ ]]; then
        # Persist in .env
        if [[ -f "$ENV_FILE" ]]; then
            sed -i "s/^WAN_INTERFACE=.*/WAN_INTERFACE=${new_wan}/" "$ENV_FILE" 2>/dev/null || true
            grep -q "^WAN_INTERFACE=" "$ENV_FILE" || echo "WAN_INTERFACE=${new_wan}" >> "$ENV_FILE"
            if [[ -n "$new_lan" ]]; then
                sed -i "s/^LAN_INTERFACE=.*/LAN_INTERFACE=${new_lan}/" "$ENV_FILE" 2>/dev/null || true
                grep -q "^LAN_INTERFACE=" "$ENV_FILE" || echo "LAN_INTERFACE=${new_lan}" >> "$ENV_FILE"
            fi
            ok "Interface assignment saved to .env"
        else
            warn ".env not found — assignment not persisted (run installer first)"
        fi
        ok "Interface assignment: WAN=${new_wan}${new_lan:+, LAN=${new_lan}}"
    fi
    press_enter
}

# ─────────────────────────────────────────────────────────────────────────────
# Option 2 — Set interface IP address
# ─────────────────────────────────────────────────────────────────────────────
_mask_to_prefix() {
    local _mask="$1"
    [[ "$_mask" =~ ^[0-9]+$ ]] && { echo "$_mask"; return; }
    local _bits=0 _o1 _o2 _o3 _o4
    IFS=. read -r _o1 _o2 _o3 _o4 <<< "$_mask"
    for _o in "${_o1:-0}" "${_o2:-0}" "${_o3:-0}" "${_o4:-0}"; do
        local _v=$(( _o ))
        while (( _v > 0 )); do
            _bits=$(( _bits + (_v & 1) ))
            _v=$(( _v >> 1 ))
        done
    done
    echo "$_bits"
}

_apply_static() {
    local _ifc="$1" _ip="$2" _prefix="$3" _gw="$4"
    local _saved_gw
    _saved_gw=$(ip route show default 2>/dev/null | awk '/^default/{print $3; exit}')
    ip link set "$_ifc" up 2>/dev/null || true
    ip addr flush dev "$_ifc" 2>/dev/null || true
    ip addr add "${_ip}/${_prefix}" dev "$_ifc" 2>/dev/null || true
    if [[ -n "$_gw" ]]; then
        ip route del default 2>/dev/null || true
        ip route add default via "$_gw" dev "$_ifc" 2>/dev/null || true
    elif [[ -n "$_saved_gw" ]]; then
        ip route del default 2>/dev/null || true
        ip route add default via "$_saved_gw" dev "$_ifc" 2>/dev/null || true
    fi
}

_apply_dhcp() {
    local _ifc="$1"
    ip link set "$_ifc" up 2>/dev/null || true
    if command -v dhclient &>/dev/null; then
        dhclient -v "$_ifc" 2>/dev/null &
        sleep 4
    elif command -v dhcpcd &>/dev/null; then
        dhcpcd "$_ifc" 2>/dev/null &
        sleep 4
    fi
}

_write_netplan() {
    local _ifc="$1" _dhcp="$2" _ip="$3" _pfx="$4" _gw="$5"
    mkdir -p /etc/netplan
    local _np_file
    if [[ -f "/etc/netplan/50-cloud-init.yaml" ]]; then
        _np_file="/etc/netplan/50-cloud-init.yaml"
    else
        _np_file=$(ls /etc/netplan/*.yaml 2>/dev/null | sort | head -1)
        _np_file="${_np_file:-/etc/netplan/50-cloud-init.yaml}"
    fi

    # Read existing config, add/update this interface, keep others
    # Simple approach: if the file only has our interface, rewrite fully
    {
        echo "network:"
        echo "  version: 2"
        echo "  renderer: networkd"
        echo "  ethernets:"
        echo "    ${_ifc}:"
        if [[ "$_dhcp" == "yes" ]]; then
            echo "      dhcp4: true"
        else
            echo "      dhcp4: false"
            echo "      addresses: [${_ip}/${_pfx}]"
            if [[ -n "$_gw" ]]; then
                echo "      routes:"
                echo "        - to: default"
                echo "          via: ${_gw}"
            fi
            echo "      nameservers:"
            echo "        addresses: [8.8.8.8, 1.1.1.1]"
        fi
    } > "${_np_file}.sonaro_iface_tmp"

    # Merge: remove old block for this interface, append new one
    if [[ -f "$_np_file" ]]; then
        # Use python3 if available for safe YAML merge, otherwise overwrite
        if command -v python3 &>/dev/null; then
            python3 - "$_np_file" "${_np_file}.sonaro_iface_tmp" "$_ifc" << 'PYEOF'
import sys, yaml
main_file, patch_file, iface = sys.argv[1], sys.argv[2], sys.argv[3]
with open(main_file) as f: main = yaml.safe_load(f) or {}
with open(patch_file) as f: patch = yaml.safe_load(f) or {}
if 'network' not in main: main['network'] = {}
if 'ethernets' not in main['network']: main['network']['ethernets'] = {}
main['network']['ethernets'].update(patch.get('network', {}).get('ethernets', {}))
main['network']['version'] = 2
main['network']['renderer'] = 'networkd'
with open(main_file, 'w') as f: yaml.dump(main, f, default_flow_style=False)
PYEOF
        else
            # No python3: overwrite (loses other interface config)
            mv "${_np_file}.sonaro_iface_tmp" "$_np_file"
        fi
    else
        mv "${_np_file}.sonaro_iface_tmp" "$_np_file"
    fi
    rm -f "${_np_file}.sonaro_iface_tmp" 2>/dev/null || true
    chmod 600 "$_np_file"
    [[ -f "/etc/netplan/90-sonaro.yaml" ]] && rm -f /etc/netplan/90-sonaro.yaml 2>/dev/null || true
    if command -v netplan &>/dev/null; then
        netplan apply 2>/dev/null && ok "Netplan applied — config will persist after reboot" \
            || warn "netplan apply failed — IP applied for this session only"
    fi
}

menu_set_ip() {
    echo ""
    echo -e "${BOLD}  Set Interface IP Address${RESET}"
    echo ""

    local ifaces=()
    while IFS= read -r line; do
        local iface
        iface=$(echo "$line" | awk -F': ' '{print $2}' | sed 's/@.*//')
        [[ "$iface" == "lo" ]] && continue
        ifaces+=("$iface")
    done < <(ip -o link show 2>/dev/null | grep -v '^[0-9]*: lo')

    if [[ "${#ifaces[@]}" -eq 0 ]]; then
        warn "No interfaces found."; press_enter; return
    fi

    local SEP="  ──────────────────────────────────────────────────────"
    echo -e "  ${BOLD}Choose an interface to configure:${RESET}"
    echo "$SEP"
    local idx=1
    for ifc in "${ifaces[@]}"; do
        local state addr mode
        state=$(ip -o link show "$ifc" 2>/dev/null | grep -oP '(?<=state )\S+' || echo "?")
        addr=$(ip -4 addr show "$ifc" 2>/dev/null | grep -oP '(?<=inet )\S+' | head -1 || true)
        [[ -z "$addr" ]] && addr="(no IP)"
        # Detect WAN/LAN role
        local role=""
        local wan_ifc lan_ifc
        wan_ifc=$(get_wan_iface)
        lan_ifc=$(get_lan_iface)
        [[ "$ifc" == "$wan_ifc" ]] && role=" [WAN]"
        [[ "$ifc" == "$lan_ifc" ]] && role=" [LAN]"
        printf "    [%d] %-14s  %-8s  %-22s%s\n" "$idx" "$ifc" "$state" "$addr" "$role"
        idx=$(( idx + 1 ))
    done
    echo "$SEP"
    echo ""
    local sel
    read -rp "  Interface number [1]: " sel < /dev/tty
    sel="${sel:-1}"
    if [[ ! "$sel" =~ ^[0-9]+$ ]] || (( sel < 1 || sel > ${#ifaces[@]} )); then
        warn "Invalid selection."; press_enter; return
    fi
    local target_ifc="${ifaces[$(( sel - 1 ))]}"

    echo ""
    echo -e "  Configuring: ${BOLD}${target_ifc}${RESET}"
    echo ""
    echo -e "    [1] DHCP   — get IP automatically"
    echo -e "    [2] Static — enter IP manually"
    echo ""
    local ip_type
    read -rp "  IP type [1]: " ip_type < /dev/tty
    ip_type="${ip_type:-1}"

    if [[ "$ip_type" == "2" ]]; then
        # Static
        local cur_ip cur_gw
        cur_ip=$(ip -4 addr show "$target_ifc" 2>/dev/null | grep -oP '(?<=inet )\d+\.\d+\.\d+\.\d+' | head -1 || true)
        cur_gw=$(ip route show default 2>/dev/null | awk '/^default/{print $3; exit}')
        local new_ip new_mask new_gw
        read -rp "  IP address${cur_ip:+ [${cur_ip}]}: " new_ip < /dev/tty
        new_ip="${new_ip:-${cur_ip}}"
        if [[ -z "$new_ip" ]]; then
            warn "IP address required."; press_enter; return
        fi
        read -rp "  Subnet mask [255.255.255.0]: " new_mask < /dev/tty
        new_mask="${new_mask:-255.255.255.0}"
        read -rp "  Default gateway${cur_gw:+ [${cur_gw}]}: " new_gw < /dev/tty
        new_gw="${new_gw:-${cur_gw}}"
        local pfx
        pfx=$(_mask_to_prefix "$new_mask")

        echo ""
        echo -e "  ${BOLD}Summary:${RESET}"
        echo -e "    Interface : ${target_ifc}"
        echo -e "    IP        : ${new_ip}/${pfx}"
        echo -e "    Gateway   : ${new_gw:-none}"
        echo ""
        read -rp "  Apply? [Y/n]: " _C < /dev/tty
        _C="${_C:-Y}"
        if [[ "${_C,,}" =~ ^(y|yes)$ ]]; then
            printf "  Applying..."
            _apply_static "$target_ifc" "$new_ip" "$pfx" "$new_gw"
            printf "\r  ${GREEN}[OK]${RESET} ${new_ip}/${pfx} on ${target_ifc}\n"
            _write_netplan "$target_ifc" "no" "$new_ip" "$pfx" "$new_gw"
            echo ""
            ok "Done. New IP: ${BOLD}${new_ip}/${pfx}${RESET} on ${target_ifc}"
        fi
    else
        # DHCP
        echo ""
        read -rp "  Request DHCP on ${target_ifc}? [Y/n]: " _C < /dev/tty
        _C="${_C:-Y}"
        if [[ "${_C,,}" =~ ^(y|yes)$ ]]; then
            printf "  Requesting DHCP..."
            _apply_dhcp "$target_ifc"
            local leased
            leased=$(ip -4 addr show "$target_ifc" 2>/dev/null | grep -oP '(?<=inet )\S+' | head -1 || true)
            if [[ -n "$leased" ]]; then
                printf "\r  ${GREEN}[OK]${RESET} Leased: ${leased} on ${target_ifc}\n"
            else
                printf "\r  ${YELLOW}[!]${RESET} DHCP in progress on ${target_ifc} (may take a moment)\n"
            fi
            _write_netplan "$target_ifc" "yes" "" "" ""
        fi
    fi
    press_enter
}

# ─────────────────────────────────────────────────────────────────────────────
# Option 3 — Reset admin password
# ─────────────────────────────────────────────────────────────────────────────
menu_reset_password() {
    echo ""
    echo -e "${BOLD}  Reset Admin Password${RESET}"
    echo ""

    local new_pass
    read -rsp "  New password for admin@sonaro.local: " new_pass < /dev/tty
    echo ""
    if [[ ${#new_pass} -lt 8 ]]; then
        warn "Password must be at least 8 characters."; press_enter; return
    fi
    read -rsp "  Confirm password: " confirm_pass < /dev/tty
    echo ""
    if [[ "$new_pass" != "$confirm_pass" ]]; then
        warn "Passwords do not match."; press_enter; return
    fi

    # Try via running API first
    local api_url="http://127.0.0.1:${PORT}/api/auth/reset-console-password"
    if curl -sf --max-time 3 "http://127.0.0.1:${PORT}/api/health" &>/dev/null; then
        local resp
        resp=$(curl -sf -X POST "$api_url" \
            -H "Content-Type: application/json" \
            -d "{\"password\":\"${new_pass}\"}" 2>/dev/null || true)
        if echo "$resp" | grep -q '"ok"'; then
            ok "Admin password updated."; press_enter; return
        fi
    fi

    # Fall back: update DB directly with node + bcrypt
    local db_url=""
    [[ -f "$ENV_FILE" ]] && db_url=$(grep -oP '(?<=DATABASE_URL=)\S+' "$ENV_FILE" 2>/dev/null || true)
    if [[ -z "$db_url" ]]; then
        warn "Cannot find DATABASE_URL in ${ENV_FILE}."; press_enter; return
    fi

    # Check if node is available
    if ! command -v node &>/dev/null; then
        warn "node not found — cannot hash password. Start the service and retry."; press_enter; return
    fi

    local hash
    hash=$(node -e "
const bcrypt = require('bcrypt');
bcrypt.hash(process.argv[1], 12).then(h => { process.stdout.write(h); process.exit(0); }).catch(() => process.exit(1));
" "$new_pass" 2>/dev/null || true)

    if [[ -z "$hash" ]]; then
        warn "Failed to generate password hash."; press_enter; return
    fi

    # Update via psql
    if command -v psql &>/dev/null; then
        psql "$db_url" -c "UPDATE users SET password_hash='${hash}' WHERE email='admin@sonaro.local';" &>/dev/null \
            && ok "Admin password updated in database." \
            || warn "psql update failed — try restarting the service."
    elif docker ps 2>/dev/null | grep -q postgres; then
        local pg_ctr
        pg_ctr=$(docker ps --format '{{.Names}}' | grep postgres | head -1)
        local db_name
        db_name=$(grep -oP '(?<=POSTGRES_DB=)\S+' "$ENV_FILE" 2>/dev/null || echo "sonaro_gate")
        local db_user
        db_user=$(grep -oP '(?<=POSTGRES_USER=)\S+' "$ENV_FILE" 2>/dev/null || echo "sonaro")
        docker exec "$pg_ctr" psql -U "$db_user" "$db_name" \
            -c "UPDATE users SET password_hash='${hash}' WHERE email='admin@sonaro.local';" &>/dev/null \
            && ok "Admin password updated in database." \
            || warn "Docker psql update failed."
    else
        warn "No psql available and service is not running. Start the service and retry."
    fi
    press_enter
}

# ─────────────────────────────────────────────────────────────────────────────
# Option 4 — Reboot
# ─────────────────────────────────────────────────────────────────────────────
menu_reboot() {
    echo ""
    read -rp "  Reboot the system? [y/N]: " _C < /dev/tty
    _C="${_C:-N}"
    if [[ "${_C,,}" =~ ^(y|yes)$ ]]; then
        echo -e "  ${YELLOW}Rebooting in 3 seconds...${RESET}"
        sleep 3
        reboot
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Option 5 — Halt
# ─────────────────────────────────────────────────────────────────────────────
menu_halt() {
    echo ""
    read -rp "  Halt the system? [y/N]: " _C < /dev/tty
    _C="${_C:-N}"
    if [[ "${_C,,}" =~ ^(y|yes)$ ]]; then
        echo -e "  ${YELLOW}Halting in 3 seconds...${RESET}"
        sleep 3
        halt -p
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Option 6 — View logs
# ─────────────────────────────────────────────────────────────────────────────
menu_logs() {
    echo ""
    echo -e "${BOLD}  View Logs${RESET}"
    echo ""
    echo -e "    [1] Sonaro Gate service logs"
    echo -e "    [2] Docker container logs"
    echo -e "    [3] System log (syslog / journald)"
    echo -e "    [4] Network (dmesg | grep eth)"
    echo ""
    local sel
    read -rp "  Choice [1]: " sel < /dev/tty
    sel="${sel:-1}"
    echo ""
    case "$sel" in
        1)
            if systemctl is-active --quiet sonaro-gate 2>/dev/null; then
                journalctl -u sonaro-gate -n 80 --no-pager
            else
                docker ps --format '{{.Names}}' | grep sonaro | while read -r c; do
                    echo -e "  ${BOLD}=== ${c} ===${RESET}"
                    docker logs --tail 80 "$c" 2>&1
                done
            fi ;;
        2)
            docker ps --format '{{.Names}}' | while read -r c; do
                echo -e "  ${BOLD}=== ${c} ===${RESET}"
                docker logs --tail 40 "$c" 2>&1
                echo ""
            done ;;
        3) journalctl -n 80 --no-pager ;;
        4) dmesg | grep -iE 'eth|ens|link' | tail -30 ;;
        *) warn "Invalid choice." ;;
    esac
    press_enter
}

# ─────────────────────────────────────────────────────────────────────────────
# Option 7 — Ping host
# ─────────────────────────────────────────────────────────────────────────────
menu_ping() {
    echo ""
    local target
    read -rp "  Ping hostname or IP [8.8.8.8]: " target < /dev/tty
    target="${target:-8.8.8.8}"
    echo ""
    ping -c 5 "$target" || true
    press_enter
}

# ─────────────────────────────────────────────────────────────────────────────
# Option 8 — Shell
# ─────────────────────────────────────────────────────────────────────────────
menu_shell() {
    echo ""
    echo -e "  ${DIM}Dropping to shell. Type ${BOLD}exit${RESET}${DIM} to return to console menu.${RESET}"
    echo ""
    bash --login < /dev/tty > /dev/tty 2>&1 || true
}

# ─────────────────────────────────────────────────────────────────────────────
# Option 9 — Restart Sonaro Gate
# ─────────────────────────────────────────────────────────────────────────────
menu_restart() {
    echo ""
    local mode
    mode=$(detect_mode)
    info "Restarting Sonaro Gate (mode: ${mode})..."
    case "$mode" in
        docker)
            local CF="${INSTALL_DIR}/deploy/docker-compose.prod.yml"
            local EF="${INSTALL_DIR}/.env"
            docker compose -f "$CF" --env-file "$EF" restart 2>/dev/null \
                && ok "Docker containers restarted." \
                || warn "docker compose restart failed — check logs (option 6)." ;;
        native)
            systemctl restart sonaro-gate 2>/dev/null \
                && ok "sonaro-gate.service restarted." \
                || warn "systemctl restart failed — check logs (option 6)." ;;
        *)
            warn "Cannot detect running mode — service may not be installed yet." ;;
    esac
    press_enter
}

# ─────────────────────────────────────────────────────────────────────────────
# Option 10 — Show management URL
# ─────────────────────────────────────────────────────────────────────────────
menu_show_url() {
    echo ""
    local lan_ip
    lan_ip=$(get_lan_ip)
    if [[ -n "$lan_ip" ]]; then
        echo -e "  ${BOLD}Web console:${RESET}  http://${lan_ip}:${PORT}"
        echo ""
        echo -e "  Default login:"
        echo -e "    Email    : admin@sonaro.local"
        echo -e "    Password : Admin123!"
    else
        local any_ip
        any_ip=$(ip -4 addr show scope global 2>/dev/null | grep -oP '(?<=inet )\d+\.\d+\.\d+\.\d+' | head -1 || true)
        warn "LAN not configured. Try:  http://${any_ip:-<SERVER_IP>}:${PORT}"
    fi
    echo ""
    press_enter
}

# ─────────────────────────────────────────────────────────────────────────────
# Option 11 — System information
# ─────────────────────────────────────────────────────────────────────────────
menu_sysinfo() {
    echo ""
    echo -e "${BOLD}  System Information${RESET}"
    echo ""
    echo -e "  Hostname   : $(hostname)"
    echo -e "  Uptime     : $(uptime -p 2>/dev/null || uptime)"
    echo -e "  OS         : $(grep PRETTY_NAME /etc/os-release 2>/dev/null | cut -d= -f2 | tr -d '"')"
    echo -e "  Kernel     : $(uname -r)"
    echo -e "  CPU        : $(nproc) core(s)"
    echo -e "  RAM        : $(free -h | awk '/^Mem:/{print $2}') total / $(free -h | awk '/^Mem:/{print $3}') used"
    echo -e "  Disk       : $(df -h / | awk 'NR==2{print $4}') free on /"
    echo ""
    echo -e "  ${BOLD}Network:${RESET}"
    ip -4 addr show scope global 2>/dev/null | awk '/^[0-9]+:/{ifc=$2} /inet /{printf "    %-16s %s\n", ifc, $2}'
    echo ""
    echo -e "  ${BOLD}Service:${RESET}  $(detect_mode) mode"
    local mode
    mode=$(detect_mode)
    case "$mode" in
        docker)
            docker ps --format "    {{.Names}}  {{.Status}}" 2>/dev/null | grep sonaro || true ;;
        native)
            systemctl status sonaro-gate --no-pager -l 2>/dev/null | head -8 || true ;;
    esac
    echo ""
    press_enter
}

# ─────────────────────────────────────────────────────────────────────────────
# Option 12 — Routing table
# ─────────────────────────────────────────────────────────────────────────────
menu_routes() {
    echo ""
    echo -e "${BOLD}  Routing Table${RESET}"
    echo ""
    ip route show 2>/dev/null || netstat -rn 2>/dev/null || true
    echo ""
    press_enter
}

# ─────────────────────────────────────────────────────────────────────────────
# Option 13 — Active connections
# ─────────────────────────────────────────────────────────────────────────────
menu_connections() {
    echo ""
    echo -e "${BOLD}  Active Connections${RESET}"
    echo ""
    if command -v ss &>/dev/null; then
        ss -tunp | head -40
    elif command -v netstat &>/dev/null; then
        netstat -tunp | head -40
    else
        warn "ss and netstat not available."
    fi
    echo ""
    press_enter
}

# ─────────────────────────────────────────────────────────────────────────────
# Main loop
# ─────────────────────────────────────────────────────────────────────────────
main() {
    # Ensure we have a controlling terminal
    if [[ ! -e /dev/tty ]]; then
        echo "Error: no terminal available. Run interactively (SSH or physical console)." >&2
        exit 1
    fi

    while true; do
        print_header
        local choice
        read -rp "  Enter an option: " choice < /dev/tty
        choice="${choice:-}"

        case "$choice" in
            0) echo ""; echo -e "  ${DIM}Goodbye.${RESET}"; echo ""; exit 0 ;;
            1) menu_assign_interfaces ;;
            2) menu_set_ip ;;
            3) menu_reset_password ;;
            4) menu_reboot ;;
            5) menu_halt ;;
            6) menu_logs ;;
            7) menu_ping ;;
            8) menu_shell ;;
            9) menu_restart ;;
            10) menu_show_url ;;
            11) menu_sysinfo ;;
            12) menu_routes ;;
            13) menu_connections ;;
            "")  ;;
            *) echo -e "  ${RED}Invalid option: ${choice}${RESET}"; sleep 1 ;;
        esac
    done
}

main "$@"
