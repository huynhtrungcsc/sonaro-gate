#!/bin/bash
# ============================================================
# Aegis NGFW Agent - Installer for Ubuntu 24.04 LTS
# Version: 3.0 — Full Self-Hosted with NIC Detection Wizard
# ============================================================
# Usage:
#   sudo bash install-agent.sh
#   sudo bash install-agent.sh --api-url http://localhost:8080/api
#   sudo bash install-agent.sh --with-dhcp --with-ids --with-av
#   sudo bash install-agent.sh --full      # Install everything
#   sudo bash install-agent.sh --auto      # Skip interactive wizard
#
# Modules:
#   --with-dhcp       Install dnsmasq (DHCP + DNS)
#   --with-dns        Install dnsmasq (DNS)
#   --with-ids        Install Suricata (IDS/IPS)
#   --with-vpn        Install StrongSwan + WireGuard
#   --with-av         Install ClamAV (antivirus)
#   --with-webfilter  Install Squid (web filter/HTTP proxy)
#   --full            Install all of the above
# ============================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

AEGIS_DIR="/opt/aegis"
API_URL="${API_URL:-}"
INSTALL_DHCP=false
INSTALL_DNS=false
INSTALL_IDS=false
INSTALL_VPN=false
INSTALL_AV=false
INSTALL_WEBFILTER=false
AUTO_MODE=false

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --api-url) API_URL="$2"; shift 2 ;;
    --with-dhcp) INSTALL_DHCP=true; shift ;;
    --with-dns) INSTALL_DNS=true; shift ;;
    --with-ids) INSTALL_IDS=true; shift ;;
    --with-vpn) INSTALL_VPN=true; shift ;;
    --with-av) INSTALL_AV=true; shift ;;
    --with-webfilter) INSTALL_WEBFILTER=true; shift ;;
    --full) INSTALL_DHCP=true; INSTALL_DNS=true; INSTALL_IDS=true; INSTALL_VPN=true; INSTALL_AV=true; INSTALL_WEBFILTER=true; shift ;;
    --auto) AUTO_MODE=true; shift ;;
    *) shift ;;
  esac
done

echo -e "${CYAN}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║     Aegis NGFW Agent Installer v3.0              ║"
echo "  ║     Ubuntu 24.04 LTS — Self-Hosted               ║"
echo "  ║     Interactive NIC Detection & Assignment        ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check root
if [[ $EUID -ne 0 ]]; then
  echo -e "${RED}Error: Must run as root (sudo)${NC}"
  exit 1
fi

# Check Ubuntu
if ! grep -qi 'ubuntu' /etc/os-release 2>/dev/null; then
  echo -e "${YELLOW}Warning: Not Ubuntu. Proceed anyway? (y/N)${NC}"
  read -r confirm
  [[ "$confirm" != "y" ]] && exit 1
fi

# ════════════════════════════════════════════════════════════
#  NIC DETECTION
# ════════════════════════════════════════════════════════════

detect_nics() {
  echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}  STEP 1: Network Interface Detection${NC}"
  echo -e "${BOLD}${CYAN}══════════════════════════════════════════════${NC}\n"

  # Get all physical network interfaces (exclude lo, docker, veth, br-, virbr)
  local all_ifaces=()
  while IFS= read -r line; do
    # ip -o link show format: "2: ens33: <FLAGS>..." — field 2 is the interface name
    local iface_name=$(echo "$line" | awk '{print $2}' | tr -d ':')
    # Skip virtual interfaces
    case "$iface_name" in
      lo|docker*|veth*|br-*|virbr*|vnet*|tun*|tap*|wg*) continue ;;
    esac
    all_ifaces+=("$iface_name")
  done < <(ip -o link show 2>/dev/null | grep -v "lo:")

  local nic_count=${#all_ifaces[@]}

  echo -e "  ${GREEN}✓${NC} Detected ${BOLD}${nic_count}${NC} network interface(s):\n"

  # Display detailed info for each NIC
  printf "  ${BOLD}%-4s %-16s %-19s %-16s %-8s %-10s${NC}\n" "#" "INTERFACE" "MAC ADDRESS" "IP ADDRESS" "STATE" "SPEED"
  echo "  ──── ──────────────── ─────────────────── ──────────────── ──────── ──────────"

  local idx=1
  for iface in "${all_ifaces[@]}"; do
    local mac=$(cat "/sys/class/net/$iface/address" 2>/dev/null || echo "N/A")
    local ip_addr=$(ip -4 addr show "$iface" 2>/dev/null | grep -oP 'inet \K[0-9.]+' | head -1)
    [[ -z "$ip_addr" ]] && ip_addr="(no IP)"
    local state=$(cat "/sys/class/net/$iface/operstate" 2>/dev/null || echo "unknown")
    local speed_val=$(cat "/sys/class/net/$iface/speed" 2>/dev/null || echo "0")
    local speed_str="${speed_val}Mbps"
    [[ "$speed_val" -ge 1000 ]] 2>/dev/null && speed_str="$(( speed_val / 1000 ))Gbps"
    [[ "$speed_val" == "0" || "$speed_val" == "-1" ]] && speed_str="N/A"

    local state_color="${RED}"
    [[ "$state" == "up" ]] && state_color="${GREEN}"

    printf "  ${BOLD}%-4s${NC} %-16s %-19s %-16s ${state_color}%-8s${NC} %-10s\n" \
      "$idx" "$iface" "$mac" "$ip_addr" "$state" "$speed_str"

    # Check for VLAN sub-interfaces
    for vlan_iface in /sys/class/net/${iface}.*; do
      if [[ -d "$vlan_iface" ]]; then
        local vlan_name=$(basename "$vlan_iface")
        local vlan_ip=$(ip -4 addr show "$vlan_name" 2>/dev/null | grep -oP 'inet \K[0-9.]+' | head -1)
        [[ -z "$vlan_ip" ]] && vlan_ip="(no IP)"
        echo -e "       └─ ${vlan_name} (VLAN) — ${vlan_ip}"
      fi
    done

    idx=$((idx + 1))
  done

  echo ""

  # ── Minimum NIC validation ──
  if [[ $nic_count -eq 0 ]]; then
    echo -e "  ${RED}✘ ERROR: No network interfaces detected!${NC}"
    echo -e "  ${RED}  Cannot configure firewall without network interfaces.${NC}"
    echo -e "  ${YELLOW}  Check your hardware or virtualization settings.${NC}"
    exit 1
  elif [[ $nic_count -eq 1 ]]; then
    echo -e "  ${YELLOW}⚠ WARNING: Only 1 NIC detected!${NC}"
    echo -e "  ${YELLOW}  Aegis NGFW requires at least 2 NICs for proper operation:${NC}"
    echo -e "  ${YELLOW}    • 1 NIC for WAN (Internet)${NC}"
    echo -e "  ${YELLOW}    • 1 NIC for LAN (Internal network)${NC}"
    echo -e ""
    echo -e "  ${CYAN}Options:${NC}"
    echo -e "    1) Continue with single NIC (limited functionality — no routing/NAT)"
    echo -e "    2) Add another NIC and re-run installer"
    echo -e "    3) Exit"
    echo -en "\n  Select [1-3]: "
    read -r choice
    case "$choice" in
      1) 
        echo -e "  ${YELLOW}→ Continuing with single NIC mode. NAT/routing disabled.${NC}"
        SINGLE_NIC_MODE=true
        ;;
      2|3|*)
        echo -e "  ${CYAN}→ Please add network interfaces and re-run the installer.${NC}"
        echo -e "  ${CYAN}  For VMs: Add a new network adapter in VM settings.${NC}"
        echo -e "  ${CYAN}  For bare metal: Install an additional NIC.${NC}"
        exit 0
        ;;
    esac
  elif [[ $nic_count -eq 2 ]]; then
    echo -e "  ${GREEN}✓ 2 NICs detected — Sufficient for WAN + LAN configuration.${NC}"
    echo -e "  ${YELLOW}  Note: Add a 3rd NIC if you need a DMZ zone.${NC}"
  elif [[ $nic_count -eq 3 ]]; then
    echo -e "  ${GREEN}✓ 3 NICs detected — Full WAN + LAN + DMZ configuration available.${NC}"
  else
    echo -e "  ${GREEN}✓ ${nic_count} NICs detected — Full multi-zone configuration available.${NC}"
  fi

  # Export for use in assignment
  export DETECTED_NICS="${all_ifaces[*]}"
  export NIC_COUNT=$nic_count
}

# ════════════════════════════════════════════════════════════
#  INTERACTIVE INTERFACE ASSIGNMENT (pfSense-style)
# ════════════════════════════════════════════════════════════

assign_interfaces() {
  local nics=($DETECTED_NICS)
  local nic_count=${#nics[@]}

  echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}  STEP 2: Interface Assignment${NC}"
  echo -e "${BOLD}${CYAN}══════════════════════════════════════════════${NC}"
  echo -e ""
  echo -e "  Assign each physical NIC to a network zone."
  echo -e "  This is similar to pfSense/OPNsense interface assignment.\n"

  local wan_iface="" lan_iface="" dmz_iface="" guest_iface="" wan2_iface=""

  if [[ "$AUTO_MODE" == "true" ]]; then
    # Auto-detect: default route → WAN, rest → LAN, DMZ, etc.
    wan_iface=$(ip route get 8.8.8.8 2>/dev/null | grep -oP 'dev \K\S+' || echo "${nics[0]}")
    for n in "${nics[@]}"; do
      [[ "$n" == "$wan_iface" ]] && continue
      if [[ -z "$lan_iface" ]]; then lan_iface="$n"
      elif [[ -z "$dmz_iface" ]]; then dmz_iface="$n"
      elif [[ -z "$guest_iface" ]]; then guest_iface="$n"
      elif [[ -z "$wan2_iface" ]]; then wan2_iface="$n"
      fi
    done
    echo -e "  ${GREEN}Auto-assigned:${NC}"
    echo -e "    WAN:   ${BOLD}${wan_iface}${NC}"
    [[ -n "$lan_iface" ]]   && echo -e "    LAN:   ${BOLD}${lan_iface}${NC}"
    [[ -n "$dmz_iface" ]]   && echo -e "    DMZ:   ${BOLD}${dmz_iface}${NC}"
    [[ -n "$guest_iface" ]] && echo -e "    GUEST: ${BOLD}${guest_iface}${NC}"
    [[ -n "$wan2_iface" ]]  && echo -e "    WAN2:  ${BOLD}${wan2_iface}${NC}"
  else
    # ── Interactive wizard ──

    # Show available NICs as numbered list
    show_available_nics() {
      local used=("$@")
      echo ""
      local idx=1
      for n in "${nics[@]}"; do
        local is_used=false
        for u in "${used[@]}"; do
          [[ "$n" == "$u" ]] && is_used=true && break
        done

        local ip_addr=$(ip -4 addr show "$n" 2>/dev/null | grep -oP 'inet \K[0-9./]+' | head -1)
        [[ -z "$ip_addr" ]] && ip_addr="no IP"
        local state=$(cat "/sys/class/net/$n/operstate" 2>/dev/null || echo "?")

        if $is_used; then
          echo -e "    ${RED}${idx}) ${n} — ${ip_addr} [${state}] (already assigned)${NC}"
        else
          echo -e "    ${GREEN}${idx}) ${n}${NC} — ${ip_addr} [${state}]"
        fi
        idx=$((idx + 1))
      done
      echo -e "    ${YELLOW}a) Auto-detect (use default route)${NC}"
      echo -e "    ${YELLOW}n) None (skip this zone)${NC}"
      echo ""
    }

    pick_nic() {
      local zone_name="$1"; shift
      local used=("$@")

      echo -e "  ${BOLD}── ${zone_name} Interface ──${NC}"
      
      # Show hint based on zone
      case "$zone_name" in
        WAN)  echo -e "  ${CYAN}The WAN interface connects to the Internet/upstream router.${NC}" ;;
        LAN)  echo -e "  ${CYAN}The LAN interface connects to your internal/trusted network.${NC}" ;;
        DMZ)  echo -e "  ${CYAN}The DMZ interface hosts public-facing servers (web, mail, etc.).${NC}" ;;
        GUEST) echo -e "  ${CYAN}The GUEST interface provides isolated network access for guests.${NC}" ;;
        WAN2) echo -e "  ${CYAN}WAN2 provides a secondary Internet connection for failover/load-balancing.${NC}" ;;
      esac

      show_available_nics "${used[@]}"

      while true; do
        echo -en "  Select interface for ${BOLD}${zone_name}${NC} [1-${#nics[@]}/a/n]: "
        read -r selection

        if [[ "$selection" == "n" || "$selection" == "N" ]]; then
          echo ""
          return 1
        fi

        if [[ "$selection" == "a" || "$selection" == "A" ]]; then
          if [[ "$zone_name" == "WAN" ]]; then
            local auto=$(ip route get 8.8.8.8 2>/dev/null | grep -oP 'dev \K\S+' || echo "")
            if [[ -n "$auto" ]]; then
              echo -e "  ${GREEN}→ Auto-detected: ${auto}${NC}\n"
              PICKED_NIC="$auto"
              return 0
            fi
          fi
          echo -e "  ${YELLOW}Auto-detect not available for ${zone_name}. Pick manually.${NC}"
          continue
        fi

        if [[ "$selection" =~ ^[0-9]+$ ]] && [[ "$selection" -ge 1 ]] && [[ "$selection" -le ${#nics[@]} ]]; then
          local picked="${nics[$((selection - 1))]}"
          
          # Check if already used
          for u in "${used[@]}"; do
            if [[ "$picked" == "$u" ]]; then
              echo -e "  ${RED}✘ ${picked} is already assigned. Choose another.${NC}"
              picked=""
              break
            fi
          done

          if [[ -n "$picked" ]]; then
            echo -e "  ${GREEN}→ ${zone_name} = ${picked}${NC}\n"
            PICKED_NIC="$picked"
            return 0
          fi
        else
          echo -e "  ${RED}Invalid selection. Try again.${NC}"
        fi
      done
    }

    local used_nics=()

    # WAN (required)
    echo ""
    while true; do
      if pick_nic "WAN" "${used_nics[@]}"; then
        wan_iface="$PICKED_NIC"
        used_nics+=("$wan_iface")
        break
      else
        echo -e "  ${RED}WAN interface is required!${NC}"
      fi
    done

    # LAN (required if >1 NIC)
    if [[ $nic_count -ge 2 ]]; then
      while true; do
        if pick_nic "LAN" "${used_nics[@]}"; then
          lan_iface="$PICKED_NIC"
          used_nics+=("$lan_iface")
          break
        else
          echo -e "  ${RED}LAN interface is required for firewall operation!${NC}"
        fi
      done
    fi

    # DMZ (optional, if 3+ NICs)
    if [[ $nic_count -ge 3 ]]; then
      if pick_nic "DMZ" "${used_nics[@]}"; then
        dmz_iface="$PICKED_NIC"
        used_nics+=("$dmz_iface")
      fi
    fi

    # GUEST (optional, if 4+ NICs)
    if [[ $nic_count -ge 4 ]]; then
      if pick_nic "GUEST" "${used_nics[@]}"; then
        guest_iface="$PICKED_NIC"
        used_nics+=("$guest_iface")
      fi
    fi

    # WAN2 (optional, if 5+ NICs or unused NICs remain)
    local remaining=$((nic_count - ${#used_nics[@]}))
    if [[ $remaining -ge 1 ]]; then
      if pick_nic "WAN2" "${used_nics[@]}"; then
        wan2_iface="$PICKED_NIC"
        used_nics+=("$wan2_iface")
      fi
    fi

    # ── Confirmation ──
    echo -e "\n${BOLD}${CYAN}  ┌──────────────────────────────────────────┐${NC}"
    echo -e "${BOLD}${CYAN}  │       Interface Assignment Summary        │${NC}"
    echo -e "${BOLD}${CYAN}  ├──────────────────────────────────────────┤${NC}"
    printf "  ${CYAN}│${NC}  %-10s → %-26s ${CYAN}│${NC}\n" "WAN" "${wan_iface:-N/A}"
    printf "  ${CYAN}│${NC}  %-10s → %-26s ${CYAN}│${NC}\n" "LAN" "${lan_iface:-N/A}"
    printf "  ${CYAN}│${NC}  %-10s → %-26s ${CYAN}│${NC}\n" "DMZ" "${dmz_iface:-N/A}"
    printf "  ${CYAN}│${NC}  %-10s → %-26s ${CYAN}│${NC}\n" "GUEST" "${guest_iface:-N/A}"
    printf "  ${CYAN}│${NC}  %-10s → %-26s ${CYAN}│${NC}\n" "WAN2" "${wan2_iface:-N/A}"
    echo -e "${BOLD}${CYAN}  └──────────────────────────────────────────┘${NC}"
    echo ""
    echo -en "  ${BOLD}Accept this assignment? (Y/n/r=restart): ${NC}"
    read -r confirm
    if [[ "$confirm" == "r" || "$confirm" == "R" ]]; then
      assign_interfaces
      return
    elif [[ "$confirm" == "n" || "$confirm" == "N" ]]; then
      echo -e "  ${YELLOW}Aborted. Re-run installer to try again.${NC}"
      exit 0
    fi
  fi

  # Export assignments
  export ASSIGNED_WAN="$wan_iface"
  export ASSIGNED_LAN="$lan_iface"
  export ASSIGNED_DMZ="$dmz_iface"
  export ASSIGNED_GUEST="$guest_iface"
  export ASSIGNED_WAN2="$wan2_iface"
}

# ════════════════════════════════════════════════════════════
#  NETWORK ZONE IP CONFIGURATION
# ════════════════════════════════════════════════════════════

configure_zone_ips() {
  echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}  STEP 3: Zone IP Configuration${NC}"
  echo -e "${BOLD}${CYAN}══════════════════════════════════════════════${NC}\n"

  if [[ "$AUTO_MODE" == "true" ]]; then
    echo -e "  ${GREEN}Auto mode: Using current IP configuration.${NC}"
    export LAN_IP=$(ip -4 addr show "$ASSIGNED_LAN" 2>/dev/null | grep -oP 'inet \K[0-9.]+' | head -1)
    export LAN_CIDR=$(ip -4 addr show "$ASSIGNED_LAN" 2>/dev/null | grep -oP 'inet \K[0-9./]+' | head -1)
    return
  fi

  # WAN — usually DHCP from ISP
  echo -e "  ${BOLD}── WAN (${ASSIGNED_WAN}) ──${NC}"
  local wan_ip=$(ip -4 addr show "$ASSIGNED_WAN" 2>/dev/null | grep -oP 'inet \K[0-9./]+' | head -1)
  if [[ -n "$wan_ip" ]]; then
    echo -e "  Current IP: ${GREEN}${wan_ip}${NC}"
    echo -e "  ${CYAN}WAN typically uses DHCP from your ISP. Keep current config? (Y/n)${NC}"
    read -r keep_wan
    if [[ "$keep_wan" == "n" || "$keep_wan" == "N" ]]; then
      echo -en "  Enter WAN IP (CIDR format, e.g. 203.0.113.1/24): "
      read -r wan_ip_new
      echo -en "  Enter WAN gateway: "
      read -r wan_gw
      # Apply will be handled by agent later
    fi
  else
    echo -e "  ${YELLOW}No IP assigned. WAN will use DHCP by default.${NC}"
  fi

  # LAN
  if [[ -n "$ASSIGNED_LAN" ]]; then
    echo -e "\n  ${BOLD}── LAN (${ASSIGNED_LAN}) ──${NC}"
    local lan_ip=$(ip -4 addr show "$ASSIGNED_LAN" 2>/dev/null | grep -oP 'inet \K[0-9./]+' | head -1)
    if [[ -n "$lan_ip" ]]; then
      echo -e "  Current IP: ${GREEN}${lan_ip}${NC}"
    fi
    echo -en "  Enter LAN IP [192.168.1.1/24]: "
    read -r lan_input
    lan_input="${lan_input:-192.168.1.1/24}"
    export LAN_IP=$(echo "$lan_input" | cut -d/ -f1)
    export LAN_CIDR="$lan_input"
    echo -e "  ${GREEN}→ LAN: ${lan_input}${NC}"
  fi

  # DMZ
  if [[ -n "$ASSIGNED_DMZ" ]]; then
    echo -e "\n  ${BOLD}── DMZ (${ASSIGNED_DMZ}) ──${NC}"
    echo -en "  Enter DMZ IP [10.0.0.1/24]: "
    read -r dmz_input
    dmz_input="${dmz_input:-10.0.0.1/24}"
    export DMZ_IP=$(echo "$dmz_input" | cut -d/ -f1)
    export DMZ_CIDR="$dmz_input"
    echo -e "  ${GREEN}→ DMZ: ${dmz_input}${NC}"
  fi

  # GUEST
  if [[ -n "$ASSIGNED_GUEST" ]]; then
    echo -e "\n  ${BOLD}── GUEST (${ASSIGNED_GUEST}) ──${NC}"
    echo -en "  Enter GUEST IP [172.16.0.1/24]: "
    read -r guest_input
    guest_input="${guest_input:-172.16.0.1/24}"
    export GUEST_IP=$(echo "$guest_input" | cut -d/ -f1)
    export GUEST_CIDR="$guest_input"
    echo -e "  ${GREEN}→ GUEST: ${guest_input}${NC}"
  fi
}

# ════════════════════════════════════════════════════════════
#  SAVE INTERFACE ASSIGNMENT TO DB (via PostgREST)
# ════════════════════════════════════════════════════════════

save_interface_assignment() {
  if [[ -z "$API_URL" ]]; then
    return 0
  fi

  echo -e "\n  ${CYAN}Saving interface assignments to database...${NC}"

  local zones=("WAN" "LAN" "DMZ" "GUEST")
  local ifaces=("$ASSIGNED_WAN" "$ASSIGNED_LAN" "$ASSIGNED_DMZ" "$ASSIGNED_GUEST")
  local ips=("" "${LAN_IP:-}" "${DMZ_IP:-}" "${GUEST_IP:-}")
  local subnets=("" "255.255.255.0" "255.255.255.0" "255.255.255.0")

  for i in "${!zones[@]}"; do
    local zone="${zones[$i]}"
    local iface="${ifaces[$i]}"
    [[ -z "$iface" ]] && continue

    local ip="${ips[$i]}"
    local mac=$(cat "/sys/class/net/$iface/address" 2>/dev/null || echo "")
    local speed_val=$(cat "/sys/class/net/$iface/speed" 2>/dev/null || echo "0")
    local speed_str="${speed_val} Mbps"
    [[ "$speed_val" -ge 1000 ]] 2>/dev/null && speed_str="$(( speed_val / 1000 )) Gbps"
    local state=$(cat "/sys/class/net/$iface/operstate" 2>/dev/null || echo "down")
    local mtu=$(cat "/sys/class/net/$iface/mtu" 2>/dev/null || echo 1500)

    local payload=$(jq -n \
      --arg name "$zone" \
      --arg type "$zone" \
      --arg status "$state" \
      --arg ip_address "${ip:-}" \
      --arg subnet "${subnets[$i]}" \
      --arg mac "$mac" \
      --arg speed "$speed_str" \
      --argjson mtu "$mtu" \
      '{name:$name, type:$type, status:$status, ip_address:$ip_address, subnet:$subnet, mac:$mac, speed:$speed, mtu:$mtu}')

    # Try to update existing, if fails create new
    local existing=$(curl -sf "${API_URL}/network_interfaces?name=eq.${zone}&select=id" 2>/dev/null || echo "[]")
    if echo "$existing" | jq -e '.[0].id' >/dev/null 2>&1; then
      local existing_id=$(echo "$existing" | jq -r '.[0].id')
      curl -sf -X PATCH \
        -H "Content-Type: application/json" \
        -H "Prefer: return=representation" \
        -d "$payload" \
        "${API_URL}/network_interfaces?id=eq.${existing_id}" >/dev/null 2>&1 && \
        echo -e "  ${GREEN}✓${NC} Updated ${zone} → ${iface} (${ip:-DHCP})" || \
        echo -e "  ${YELLOW}○${NC} Could not update ${zone}"
    else
      curl -sf -X POST \
        -H "Content-Type: application/json" \
        -H "Prefer: return=representation" \
        -d "$payload" \
        "${API_URL}/network_interfaces" >/dev/null 2>&1 && \
        echo -e "  ${GREEN}✓${NC} Created ${zone} → ${iface} (${ip:-DHCP})" || \
        echo -e "  ${YELLOW}○${NC} Could not create ${zone} (DB may be unreachable)"
    fi
  done
}

# ════════════════════════════════════════════════════════════
#  MAIN INSTALLATION FLOW
# ════════════════════════════════════════════════════════════

echo -e "${GREEN}[1/8]${NC} Detecting network interfaces..."
detect_nics

echo -e "${GREEN}[2/8]${NC} Interface assignment wizard..."
if [[ "${SINGLE_NIC_MODE:-false}" == "true" ]]; then
  ASSIGNED_WAN="${DETECTED_NICS%% *}"
  ASSIGNED_LAN=""
  ASSIGNED_DMZ=""
  ASSIGNED_GUEST=""
  ASSIGNED_WAN2=""
  echo -e "  ${YELLOW}Single NIC mode: ${ASSIGNED_WAN} assigned as WAN only.${NC}"
else
  assign_interfaces
fi

echo -e "${GREEN}[3/8]${NC} Zone IP configuration..."
if [[ "${SINGLE_NIC_MODE:-false}" != "true" ]]; then
  configure_zone_ips
fi

echo -e "${GREEN}[4/8]${NC} Installing core dependencies..."
apt-get update -qq
apt-get install -y -qq curl jq bc nftables iptables iproute2 >/dev/null

echo -e "${GREEN}[5/8]${NC} Installing optional services..."
if [[ "$INSTALL_DHCP" == "true" || "$INSTALL_DNS" == "true" ]]; then
  echo "  → Installing dnsmasq..."
  apt-get install -y -qq dnsmasq >/dev/null
  systemctl stop dnsmasq 2>/dev/null || true
  systemctl disable dnsmasq 2>/dev/null || true
fi

if [[ "$INSTALL_IDS" == "true" ]]; then
  echo "  → Installing Suricata..."
  apt-get install -y -qq suricata >/dev/null
fi

if [[ "$INSTALL_VPN" == "true" ]]; then
  echo "  → Installing StrongSwan & WireGuard..."
  apt-get install -y -qq strongswan wireguard-tools >/dev/null
fi

if [[ "$INSTALL_AV" == "true" ]]; then
  echo "  → Installing ClamAV (antivirus engine)..."
  apt-get install -y -qq clamav clamav-daemon clamav-freshclam >/dev/null
  # Stop services — agent will manage them
  systemctl stop clamav-daemon 2>/dev/null || true
  systemctl stop clamav-freshclam 2>/dev/null || true
  # Initial virus database update
  echo "  → Updating ClamAV virus definitions (this may take a minute)..."
  freshclam --quiet 2>/dev/null || true
  # Enable services
  systemctl enable clamav-freshclam 2>/dev/null || true
  systemctl enable clamav-daemon 2>/dev/null || true
  systemctl start clamav-freshclam 2>/dev/null || true
  systemctl start clamav-daemon 2>/dev/null || true
  echo -e "  ${GREEN}✓${NC} ClamAV installed and virus definitions updated"
fi

if [[ "$INSTALL_WEBFILTER" == "true" ]]; then
  echo "  → Installing Squid (web filter / HTTP proxy)..."
  apt-get install -y -qq squid squidclamav >/dev/null 2>&1 || \
    apt-get install -y -qq squid >/dev/null
  systemctl stop squid 2>/dev/null || true
  systemctl disable squid 2>/dev/null || true
  echo -e "  ${GREEN}✓${NC} Squid proxy installed (agent will configure)"
fi

echo -e "${GREEN}[6/8]${NC} Installing agent..."
mkdir -p "$AEGIS_DIR"/{rules,backups}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp "$SCRIPT_DIR/aegis-agent.sh" "$AEGIS_DIR/aegis-agent.sh"
chmod +x "$AEGIS_DIR/aegis-agent.sh"

# Prompt for API URL if not provided
if [[ -z "$API_URL" ]]; then
  echo -en "  Enter API URL [http://localhost:8080/api]: "
  read -r API_URL
  API_URL="${API_URL:-http://localhost:8080/api}"
fi

# Generate agent secret if not set
AGENT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p | tr -d '\n' | head -c 64)

cat > "$AEGIS_DIR/.env" <<EOF
# ============================================================
# Aegis NGFW Agent Configuration v3.0
# Generated by installer on $(date)
# ============================================================

# PostgREST API URL
API_URL=${API_URL}

# Agent authentication key
AGENT_SECRET_KEY=${AGENT_SECRET}

# Sync intervals (seconds)
SYNC_INTERVAL=60
METRICS_INTERVAL=30

# Firewall backend: nft (recommended) or ipt
FIREWALL_BACKEND=nft

# Hostname identifier
HOSTNAME_ID=$(hostname)

# ── Interface Mapping (auto-detected) ──
IFACE_WAN=${ASSIGNED_WAN:-eth0}
IFACE_LAN=${ASSIGNED_LAN:-eth1}
IFACE_DMZ=${ASSIGNED_DMZ:-eth2}
IFACE_GUEST=${ASSIGNED_GUEST:-eth3}
IFACE_WAN2=${ASSIGNED_WAN2:-eth4}

# Service backends
DHCP_BACKEND=dnsmasq
DNS_BACKEND=dnsmasq
DNSMASQ_CONF_DIR=/etc/dnsmasq.d

# Agent directory
AEGIS_DIR=/opt/aegis

# Dry run mode
DRY_RUN=false
EOF

echo -e "  ${GREEN}✓${NC} Config saved to ${CYAN}$AEGIS_DIR/.env${NC}"

echo -e "${GREEN}[7/8]${NC} Installing systemd service & log rotation..."
cp "$SCRIPT_DIR/aegis-agent.service" /etc/systemd/system/aegis-agent.service
systemctl daemon-reload

cat > /etc/logrotate.d/aegis-agent <<'LOGROTATE'
/opt/aegis/agent.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 root root
    postrotate
        systemctl reload aegis-agent 2>/dev/null || true
    endscript
}
LOGROTATE

# Enable IP forwarding
echo "net.ipv4.ip_forward = 1" > /etc/sysctl.d/90-aegis.conf
sysctl -p /etc/sysctl.d/90-aegis.conf 2>/dev/null || true

echo -e "${GREEN}[8/8]${NC} Saving interface assignment to database..."

# Grant agent write permissions on existing database (for upgrades)
echo -e "  ${CYAN}Ensuring agent has write permissions on database...${NC}"
if command -v docker &>/dev/null; then
  docker exec -i aegis-db psql -U "${POSTGRES_USER:-aegis}" -d "${POSTGRES_DB:-aegis_ngfw}" <<'GRANTS' 2>/dev/null || true
GRANT INSERT, UPDATE ON public.system_metrics TO anon;
GRANT INSERT, UPDATE ON public.network_interfaces TO anon;
GRANT INSERT, UPDATE ON public.threat_events TO anon;
GRANT INSERT, UPDATE ON public.traffic_stats TO anon;
GRANT INSERT, UPDATE ON public.firmware_info TO anon;
GRANT INSERT, UPDATE ON public.config_backups TO anon;
GRANT INSERT, UPDATE ON public.network_devices TO anon;
GRANT INSERT, UPDATE ON public.packet_captures TO anon;
GRANT INSERT, UPDATE ON public.dhcp_leases TO anon;
GRANT INSERT, UPDATE ON public.ai_analysis TO anon;
GRANTS
  echo -e "  ${GREEN}✓${NC} Database permissions updated"
fi

save_interface_assignment

# Auto-start agent service
echo -e "\n  ${CYAN}Starting Aegis Agent service...${NC}"
systemctl enable aegis-agent 2>/dev/null || true
systemctl restart aegis-agent 2>/dev/null || true
if systemctl is-active --quiet aegis-agent; then
  echo -e "  ${GREEN}✓${NC} Agent service started and enabled"
else
  echo -e "  ${YELLOW}○${NC} Agent service may need manual start: systemctl start aegis-agent"
fi

# ════════════════════════════════════════════════════════════
#  SUMMARY
# ════════════════════════════════════════════════════════════

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Aegis NGFW Agent v3.0 — Installation Complete${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Interface Assignment:${NC}"
echo -e "    WAN:   ${CYAN}${ASSIGNED_WAN:-N/A}${NC}"
[[ -n "$ASSIGNED_LAN" ]]   && echo -e "    LAN:   ${CYAN}${ASSIGNED_LAN}${NC}  (${LAN_IP:-DHCP})"
[[ -n "$ASSIGNED_DMZ" ]]   && echo -e "    DMZ:   ${CYAN}${ASSIGNED_DMZ}${NC}  (${DMZ_IP:-N/A})"
[[ -n "$ASSIGNED_GUEST" ]] && echo -e "    GUEST: ${CYAN}${ASSIGNED_GUEST}${NC}  (${GUEST_IP:-N/A})"
[[ -n "$ASSIGNED_WAN2" ]]  && echo -e "    WAN2:  ${CYAN}${ASSIGNED_WAN2}${NC}"
echo ""
echo -e "  ${BOLD}Next steps:${NC}"
echo -e "    1. Review config:    ${CYAN}nano $AEGIS_DIR/.env${NC}"
echo -e "    2. Test connection:  ${CYAN}$AEGIS_DIR/aegis-agent.sh status${NC}"
echo -e "    3. Dry-run test:     ${CYAN}$AEGIS_DIR/aegis-agent.sh test${NC}"
echo -e "    4. Start service:    ${CYAN}systemctl enable --now aegis-agent${NC}"
echo -e "    5. View logs:        ${CYAN}tail -f $AEGIS_DIR/agent.log${NC}"
echo -e "    6. Web UI:           ${CYAN}http://<server-ip>/ → Interfaces page${NC}"
echo ""

# Services status
echo -e "  ${BOLD}Installed services:${NC}"
for svc in nftables dnsmasq suricata strongswan wireguard-tools clamav-daemon squid; do
  if dpkg -l "$svc" &>/dev/null 2>&1; then
    echo -e "    ${GREEN}✓${NC} $svc"
  else
    echo -e "    ${YELLOW}○${NC} $svc (not installed)"
  fi
done
echo ""
echo -e "  ${BOLD}Agent Secret Key:${NC}"
echo -e "    ${YELLOW}${AGENT_SECRET}${NC}"
echo -e "    ${CYAN}Save this key! You'll need it for the web UI configuration.${NC}"
echo ""
echo -e "${YELLOW}100% self-hosted. No cloud services required.${NC}"
echo ""
