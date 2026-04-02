# CLI Network Setup Guide — WAN / LAN / DMZ

> **Do this before opening the web UI.** The firewall needs to know which network card faces the internet (WAN) and which faces your internal network (LAN). Without this, the machine has no routing and you cannot reach port 5000 from another device.

---

## Overview

```
                    INTERNET / ISP
                         │
                  ┌──────┴──────┐
                  │  WAN (eth0) │  ← Public IP (DHCP or Static)
                  │             │
                  │ SONARO GATE │  ← Ubuntu 24.04 LTS machine
                  │             │
                  │  LAN (eth1) │  ← 192.168.1.1 (your LAN gateway)
                  └──────┬──────┘
                         │
              ┌──────────┴──────────┐
           PC / server          Switch / AP
        (browser → http://192.168.1.1:5000)
```

If you have a DMZ or management port:

```
                  ┌────────────────────┐
                  │  WAN  (eth0)       │  Internet
                  │  LAN  (eth1)       │  Internal LAN (192.168.1.0/24)
                  │  DMZ  (eth2)       │  Servers zone (10.10.0.0/24)
                  │  MGMT (eth3)       │  Admin access only
                  └────────────────────┘
```

---

## Step 1 — Identify Your Network Cards

Log into the Ubuntu machine (locally or via SSH from the WAN side before cutting over):

```bash
ip link show
```

Example output:

```
1: lo: <LOOPBACK,UP,LOWER_UP> ...           ← loopback, ignore this
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP>  ← physical NIC #1
3: eth1: <BROADCAST,MULTICAST>              ← physical NIC #2
4: eth2: <BROADCAST,MULTICAST>              ← physical NIC #3 (optional)
```

> On cloud VMs or modern systems the names may be `ens3`, `ens4`, `enp2s0`, `enp3s0`, etc. The names vary by hardware. Use `ip link show` to see yours.

To see which card has an IP already (usually the one you're connected to):

```bash
ip addr show
```

To see which card is connected to your upstream router (has a default route):

```bash
ip route show
# Look for: default via <gateway_ip> dev <interface_name>
# Example:  default via 203.0.113.1 dev eth0
```

---

## Step 2 — Run the CLI Setup Wizard

The installer already set up Sonaro Gate as a systemd service. On **first boot**, if you run it in a terminal as root, the wizard launches automatically.

```bash
# Stop the background service first
sudo systemctl stop sonaro-gate

# Run interactively — the wizard only works when connected to a real terminal
sudo -E npx tsx /opt/sonaro/server/index.ts
```

> **Note**: The wizard requires both `root` and an interactive terminal (TTY). It will not run when backgrounded, piped, or run from a non-TTY session.

### What the Wizard Looks Like

```
══════════════════════════════════════════════════════════════
              SONARO GATE • 2025.1 LTS
          Initial Configuration Wizard
══════════════════════════════════════════════════════════════

  Detecting network interfaces...

  Available interfaces:
  ─────────────────────────────────────────────────────────
  [1] eth0   00:15:5d:01:02:03   ↑ UP     1 Gbps
  [2] eth1   00:15:5d:01:02:04   ↓ DOWN
  [3] eth2   00:15:5d:01:02:05   ↓ DOWN

  ── WAN (Internet-facing) Interface ──────────────────────
  Select WAN interface [1]: 1

  WAN IP type:
    (1) DHCP  — get IP automatically from ISP / router
    (2) Static — enter IP manually
  Choice [1]: 2

  WAN IP address (e.g. 203.0.113.10): 203.0.113.10
  Subnet mask [255.255.255.0]:
  Default gateway: 203.0.113.1
  Primary DNS [8.8.8.8]:

  ── LAN (Internal Network) Interface ─────────────────────
  Select LAN interface [2]: 2
  LAN IP address [192.168.1.1]:
  LAN subnet [255.255.255.0]:

  ── DMZ Interface (optional) ─────────────────────────────
  Configure a DMZ interface? [y/N]: y
  Select DMZ interface [3]: 3
  DMZ IP address [10.10.0.1]:
  DMZ subnet [255.255.255.0]:

  ── Admin Account ─────────────────────────────────────────
  Admin email [admin@sonaro.local]:
  Admin password: ••••••••

  ── Hostname ──────────────────────────────────────────────
  Firewall hostname [sonaro-gw-01]:

  Applying configuration...
  [✓] Netplan config written to /etc/netplan/90-sonaro.yaml
  [✓] netplan apply — interfaces configured
  [✓] IP forwarding enabled (sysctl + /etc/sysctl.d/99-sonaro.conf)
  [✓] NAT masquerade rule on eth0
  [✓] Configuration saved to database
  [✓] Wizard complete — setup_complete = true

══════════════════════════════════════════════════════════════
  Web UI:  http://192.168.1.1:5000
  Login:   admin@sonaro.local / (your password)
══════════════════════════════════════════════════════════════
```

After the wizard finishes, restart the service:

```bash
sudo systemctl start sonaro-gate
```

---

## Step 3 — Manual Configuration (without the wizard)

If you prefer to configure interfaces manually, or need to change settings after the wizard, use Netplan directly.

### 3a — Find the Netplan config file

```bash
ls /etc/netplan/
# The installer creates: /etc/netplan/90-sonaro.yaml
# Ubuntu default may have: /etc/netplan/00-installer-config.yaml
```

### 3b — WAN via DHCP + LAN Static

```bash
sudo nano /etc/netplan/90-sonaro.yaml
```

```yaml
network:
  version: 2
  renderer: networkd

  ethernets:
    # WAN — gets IP from ISP / upstream router via DHCP
    eth0:
      dhcp4: true
      dhcp6: false

    # LAN — static, acts as gateway for your internal network
    eth1:
      dhcp4: false
      addresses:
        - 192.168.1.1/24
```

### 3c — WAN Static IP + LAN Static + DMZ

```yaml
network:
  version: 2
  renderer: networkd

  ethernets:
    # WAN — static IP from your ISP
    eth0:
      dhcp4: false
      addresses:
        - 203.0.113.10/24
      routes:
        - to: default
          via: 203.0.113.1
      nameservers:
        addresses: [8.8.8.8, 1.1.1.1]

    # LAN — internal network gateway
    eth1:
      dhcp4: false
      addresses:
        - 192.168.1.1/24

    # DMZ — isolated server zone
    eth2:
      dhcp4: false
      addresses:
        - 10.10.0.1/24
```

### 3d — Apply the Netplan Config

```bash
# Validate first (safe — does not apply yet)
sudo netplan try

# If it looks correct, press ENTER to accept, or wait 120s for auto-revert

# Or apply immediately (without confirmation)
sudo netplan apply
```

### 3e — Enable IP Forwarding

Sonaro Gate must forward packets between interfaces to act as a router:

```bash
# Enable now (immediate effect)
sudo sysctl -w net.ipv4.ip_forward=1

# Make permanent (survives reboots)
echo "net.ipv4.ip_forward=1"     | sudo tee /etc/sysctl.d/99-sonaro.conf
echo "net.ipv6.conf.all.forwarding=1" >> /etc/sysctl.d/99-sonaro.conf
sudo sysctl -p /etc/sysctl.d/99-sonaro.conf
```

### 3f — Enable NAT (internet sharing for LAN)

```bash
# Replace eth0 with your actual WAN interface name
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE

# Save rules so they persist after reboot
sudo netfilter-persistent save
```

---

## Step 4 — Verify the Configuration

### Check interfaces got their IPs

```bash
ip addr show eth0    # WAN — should have your WAN IP
ip addr show eth1    # LAN — should show 192.168.1.1/24
ip addr show eth2    # DMZ — should show 10.10.0.1/24 (if configured)
```

### Check routing table

```bash
ip route show
# Expected:
# default via 203.0.113.1 dev eth0         ← WAN default route
# 192.168.1.0/24 dev eth1 proto kernel ... ← LAN directly connected
# 10.10.0.0/24   dev eth2 proto kernel ... ← DMZ directly connected
```

### Check IP forwarding is on

```bash
cat /proc/sys/net/ipv4/ip_forward
# Must print: 1
```

### Check NAT is active

```bash
sudo iptables -t nat -L POSTROUTING -v -n
# Should show a MASQUERADE rule on eth0
```

### Check Sonaro Gate is running

```bash
sudo systemctl status sonaro-gate
# Should show: active (running)
```

---

## Step 5 — Access the Web UI

From a device on the **LAN side** of the firewall, open:

```
http://192.168.1.1:5000
```

Login:
- Email: `admin@sonaro.local`
- Password: `Admin123!` (or what you set in the wizard)

> **If using DHCP on WAN** and you don't know the WAN IP, run `ip addr show eth0` on the firewall machine to see the assigned IP.

> **If you cannot reach the web UI** from the LAN: check that your LAN device has a default gateway set to `192.168.1.1`. Also confirm Sonaro Gate is running: `sudo systemctl status sonaro-gate`.

---

## Common Interface Name Reference

| Hardware | WAN name | LAN name |
|---|---|---|
| Physical PC (PCI-E NIC) | `eth0` or `enp2s0` | `eth1` or `enp3s0` |
| Raspberry Pi | `eth0` | `eth1` (USB adapter) |
| VMware/VirtualBox | `ens33` | `ens34` |
| Proxmox VM | `ens18` | `ens19` |
| Cloud (AWS/GCP) | `ens3` or `eth0` | add a second ENI/NIC |

Run `ip link show` to confirm the exact names on your system.

---

## After First Login — Web UI Network Configuration

Once logged in, you can manage network interfaces from the web UI:

- **Interfaces** → view all NICs, change IPs, enable/disable
- **Firewall → Rules** → allow/deny traffic between zones
- **Firewall → NAT** → port forwarding and masquerade rules
- **Routing → Static** → add manual routes
- **System → Settings** → change hostname, timezone

Any change you save in the web UI and click **Apply Config** will run the equivalent `iptables` / `ip` / `netplan` commands on the Ubuntu system immediately.

---

## Re-running the Wizard

If you want to reconfigure from scratch (e.g., moved the firewall to a different network):

```bash
# Mark setup as incomplete in the database
sudo -u postgres psql -d sonaro_gate -c \
  "UPDATE system_settings SET value='false' WHERE key='setup_complete';"

# Stop the service and re-run interactively
sudo systemctl stop sonaro-gate
sudo -E npx tsx /opt/sonaro/server/index.ts
```
