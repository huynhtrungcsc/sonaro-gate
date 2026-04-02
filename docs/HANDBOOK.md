# Sonaro Gate 2025.1 LTS — Handbook

**Document Version:** 2025.1 LTS  
**Build:** 2025.04  
**Platform:** Ubuntu 24.04 LTS (Noble Numbat) — x86\_64  
**Revised:** April 2026

---

**SONARO GATE DOCUMENTATION**  
https://github.com/your-org/sonaro-gate

**TECHNICAL SUPPORT**  
admin@sonaro.local (internal)

**FEEDBACK**  
Submit issues via the project repository

**LICENSE**  
See `LICENSE` file in the project root.

---

## Table of Contents

1. [Change Log](#1-change-log)
2. [What's New](#2-whats-new)
3. [Sonaro Gate Overview](#3-sonaro-gate-overview)
   - 3.1 [Product Description](#31-product-description)
   - 3.2 [System Architecture](#32-system-architecture)
   - 3.3 [Linux Daemon Stack](#33-linux-daemon-stack)
   - 3.4 [Network Data Flow](#34-network-data-flow)
   - 3.5 [Supported Platforms](#35-supported-platforms)
4. [System Requirements](#4-system-requirements)
   - 4.1 [Minimum Hardware](#41-minimum-hardware)
   - 4.2 [Recommended Hardware](#42-recommended-hardware)
   - 4.3 [Software Prerequisites](#43-software-prerequisites)
   - 4.4 [Network Interface Requirements](#44-network-interface-requirements)
5. [Getting Started](#5-getting-started)
   - 5.1 [Automated Installation (Ubuntu 24.04 LTS)](#51-automated-installation-ubuntu-2404-lts)
   - 5.2 [First-Boot CLI Wizard](#52-first-boot-cli-wizard)
   - 5.3 [Accessing the Web Management Console](#53-accessing-the-web-management-console)
   - 5.4 [Initial Login and Password Change](#54-initial-login-and-password-change)
   - 5.5 [Configuration via Docker](#55-configuration-via-docker)
   - 5.6 [Verifying System Status](#56-verifying-system-status)
6. [Dashboard](#6-dashboard)
   - 6.1 [Resource Usage Widgets](#61-resource-usage-widgets)
   - 6.2 [Traffic Overview](#62-traffic-overview)
   - 6.3 [Threat Summary](#63-threat-summary)
   - 6.4 [Auto-Refresh Behavior](#64-auto-refresh-behavior)
7. [Network Interfaces](#7-network-interfaces)
   - 7.1 [Viewing Interfaces](#71-viewing-interfaces)
   - 7.2 [Editing Interface Settings](#72-editing-interface-settings)
   - 7.3 [Applying Configuration (Netplan)](#73-applying-configuration-netplan)
   - 7.4 [Interface Assignment](#74-interface-assignment)
   - 7.5 [VLAN Sub-Interfaces](#75-vlan-sub-interfaces)
   - 7.6 [Enabling IP Forwarding](#76-enabling-ip-forwarding)
8. [Firewall Policies](#8-firewall-policies)
   - 8.1 [Policy Architecture](#81-policy-architecture)
   - 8.2 [Creating a Firewall Rule](#82-creating-a-firewall-rule)
   - 8.3 [Rule Ordering and Priority](#83-rule-ordering-and-priority)
   - 8.4 [Services and Port Groups](#84-services-and-port-groups)
   - 8.5 [Schedules](#85-schedules)
   - 8.6 [Aliases (Address Objects)](#86-aliases-address-objects)
   - 8.7 [Wildcard FQDN Objects](#87-wildcard-fqdn-objects)
   - 8.8 [Applying Rules to the Kernel (iptables)](#88-applying-rules-to-the-kernel-iptables)
9. [NAT and IP Masquerading](#9-nat-and-ip-masquerading)
   - 9.1 [NAT Architecture on Ubuntu](#91-nat-architecture-on-ubuntu)
   - 9.2 [Configuring Outbound NAT (Masquerade)](#92-configuring-outbound-nat-masquerade)
   - 9.3 [Virtual IP (DNAT / Port Forwarding)](#93-virtual-ip-dnat--port-forwarding)
   - 9.4 [IP Pools (SNAT)](#94-ip-pools-snat)
   - 9.5 [Applying NAT Rules](#95-applying-nat-rules)
10. [Routing](#10-routing)
    - 10.1 [Static Routes](#101-static-routes)
    - 10.2 [Policy-Based Routing (PBR)](#102-policy-based-routing-pbr)
    - 10.3 [Dynamic Routing with FRRouting](#103-dynamic-routing-with-frrouting)
    - 10.4 [OSPF Configuration](#104-ospf-configuration)
    - 10.5 [BGP Configuration](#105-bgp-configuration)
    - 10.6 [RIP Configuration](#106-rip-configuration)
    - 10.7 [Viewing the Routing Table](#107-viewing-the-routing-table)
11. [VPN](#11-vpn)
    - 11.1 [VPN Overview](#111-vpn-overview)
    - 11.2 [IPsec with strongSwan](#112-ipsec-with-strongswan)
    - 11.3 [Configuring an IPsec Site-to-Site Tunnel](#113-configuring-an-ipsec-site-to-site-tunnel)
    - 11.4 [WireGuard VPN](#114-wireguard-vpn)
    - 11.5 [Configuring a WireGuard Tunnel](#115-configuring-a-wireguard-tunnel)
    - 11.6 [VPN Monitoring](#116-vpn-monitoring)
12. [DHCP Server](#12-dhcp-server)
    - 12.1 [DHCP Architecture (dnsmasq)](#121-dhcp-architecture-dnsmasq)
    - 12.2 [Configuring a DHCP Server](#122-configuring-a-dhcp-server)
    - 12.3 [Static IP Mappings (Reservations)](#123-static-ip-mappings-reservations)
    - 12.4 [Viewing Active Leases](#124-viewing-active-leases)
13. [DNS Server](#13-dns-server)
    - 13.1 [DNS Architecture](#131-dns-architecture)
    - 13.2 [Forward Zones](#132-forward-zones)
    - 13.3 [Local DNS Records](#133-local-dns-records)
    - 13.4 [DNS Filter Profiles](#134-dns-filter-profiles)
14. [Traffic Shaping and QoS](#14-traffic-shaping-and-qos)
    - 14.1 [Traffic Shapers](#141-traffic-shapers)
    - 14.2 [Traffic Shaping Policies](#142-traffic-shaping-policies)
    - 14.3 [tc/HTB Implementation on Ubuntu](#143-tchtb-implementation-on-ubuntu)
15. [IDS / IPS](#15-ids--ips)
    - 15.1 [Suricata Overview](#151-suricata-overview)
    - 15.2 [IDS Settings](#152-ids-settings)
    - 15.3 [Threat Monitor and Incidents](#153-threat-monitor-and-incidents)
    - 15.4 [Signature Updates](#154-signature-updates)
16. [High Availability](#16-high-availability)
    - 16.1 [HA Architecture (keepalived VRRP)](#161-ha-architecture-keepalived-vrrp)
    - 16.2 [Configuring HA](#162-configuring-ha)
    - 16.3 [Failover Behavior](#163-failover-behavior)
    - 16.4 [HA Limitations on Ubuntu](#164-ha-limitations-on-ubuntu)
17. [Certificate Management](#17-certificate-management)
    - 17.1 [Generating Self-Signed Certificates](#171-generating-self-signed-certificates)
    - 17.2 [Importing CA / Intermediate Certificates](#172-importing-ca--intermediate-certificates)
    - 17.3 [Let's Encrypt Integration](#173-lets-encrypt-integration)
18. [User and Access Management](#18-user-and-access-management)
    - 18.1 [Local User Accounts](#181-local-user-accounts)
    - 18.2 [Admin Profiles and RBAC](#182-admin-profiles-and-rbac)
    - 18.3 [User Groups](#183-user-groups)
    - 18.4 [JWT Authentication](#184-jwt-authentication)
19. [System Administration](#19-system-administration)
    - 19.1 [System Settings](#191-system-settings)
    - 19.2 [Backup and Restore](#192-backup-and-restore)
    - 19.3 [Configuration Restore](#193-configuration-restore)
    - 19.4 [Firmware Upgrade](#194-firmware-upgrade)
    - 19.5 [System Logs](#195-system-logs)
    - 19.6 [Log Reports](#196-log-reports)
    - 19.7 [Packet Capture](#197-packet-capture)
    - 19.8 [Rebooting and Shutdown](#198-rebooting-and-shutdown)
20. [CLI Reference](#20-cli-reference)
    - 20.1 [Built-in Web CLI Console](#201-built-in-web-cli-console)
    - 20.2 [SSH Console Access](#202-ssh-console-access)
    - 20.3 [CLI Command Reference](#203-cli-command-reference)
21. [REST API Reference](#21-rest-api-reference)
    - 21.1 [Authentication](#211-authentication)
    - 21.2 [CRUD Endpoints](#212-crud-endpoints)
    - 21.3 [System Endpoints](#213-system-endpoints)
22. [Troubleshooting](#22-troubleshooting)
    - 22.1 [Firewall Rules Not Applying](#221-firewall-rules-not-applying)
    - 22.2 [NAT / Internet Not Working](#222-nat--internet-not-working)
    - 22.3 [DHCP Clients Not Receiving Addresses](#223-dhcp-clients-not-receiving-addresses)
    - 22.4 [VPN Tunnels Not Establishing](#224-vpn-tunnels-not-establishing)
    - 22.5 [Web Console Not Accessible](#225-web-console-not-accessible)
    - 22.6 [IDS Not Detecting Threats](#226-ids-not-detecting-threats)
23. [Appendix](#23-appendix)
    - 23.1 [Daemon Matrix](#231-daemon-matrix)
    - 23.2 [Database Schema Summary](#232-database-schema-summary)
    - 23.3 [Netplan Template Reference](#233-netplan-template-reference)
    - 23.4 [iptables Chain Architecture](#234-iptables-chain-architecture)
    - 23.5 [Default Port Reference](#235-default-port-reference)
    - 23.6 [Environment Variables](#236-environment-variables)

---

## 1. Change Log

| Version | Date | Changes |
|---------|------|---------|
| 2025.1 LTS | 2026-04 | Initial public release. Full iptables integration, Netplan persistence, CLI wizard, React web console, PostgREST API, TanStack Query UI, real OS metrics via systeminformation |
| 2025.0 (beta) | 2026-01 | Internal beta. Core firewall engine, NAT, static routing |

---

## 2. What's New

### What's new for Sonaro Gate 2025.1 LTS

- **Real iptables enforcement** — All firewall rules and NAT policies are written directly to the kernel iptables chain (`sonaro-FORWARD`, `sonaro-NAT`). No userspace emulation.
- **Netplan persistence** — Interface configuration changes are written to `/etc/netplan/90-sonaro.yaml` and applied with `netplan apply`.
- **First-boot CLI wizard** — Interactive terminal wizard (pfSense-style) for hostname, WAN/LAN selection, IP assignment, and admin credentials. Runs automatically on first boot when launched as root.
- **Background system agent** — Collects real CPU, memory, disk, NIC statistics via `systeminformation` every 30 seconds and persists to PostgreSQL.
- **PostgREST-compatible API** — All 30+ database tables exposed via `/api/data/<table>` with filter, order, limit, and offset support.
- **TanStack Query v5 frontend** — All data in the React console is fetched live from the API. No mock data. Cache invalidation after every mutation.
- **JWT authentication** — `POST /api/rpc/authenticate` issues a signed JWT. All API routes require `Authorization: Bearer <token>`.
- **Docker support** — Multi-stage Dockerfile + `docker-compose.yml` for containerized deployment (requires `privileged: true` and `network_mode: host`).

---

## 3. Sonaro Gate Overview

### 3.1 Product Description

**Sonaro Gate 2025.1 LTS** is an open-source, Next-Generation Firewall (NGFW) management system designed for deployment on **Ubuntu 24.04 LTS** bare-metal servers. It provides:

- Stateful packet filtering via **iptables/netfilter**
- Network Address Translation (**NAT / DNAT / SNAT**)
- IPv4 routing — static, policy-based, and dynamic (OSPF/BGP/RIP via FRRouting)
- IPsec VPN via **strongSwan** and WireGuard VPN via **wireguard-tools**
- DHCP server and DNS server via **dnsmasq**
- Intrusion Detection and Prevention via **Suricata**
- High Availability via **keepalived VRRP**
- Traffic shaping / QoS via **tc (HTB)**
- A React-based web management console accessible on port **5000**
- A built-in CLI console accessible from the web UI

Unlike dedicated ASIC-based firewall appliances, Sonaro Gate runs entirely on standard Linux kernel features and open-source daemon software. There is no proprietary hardware dependency.

### 3.2 System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     SONARO GATE 2025.1 LTS                          │
│                     Ubuntu 24.04 LTS — x86_64                       │
├──────────────────────────┬──────────────────────────────────────────┤
│   WEB MANAGEMENT         │   PACKET FORWARDING PLANE                │
│   (port 5000)            │                                          │
│                          │   ┌─────────┐  iptables  ┌───────────┐  │
│  ┌──────────────────┐    │   │  WAN    │ ──────────▶ │   LAN     │  │
│  │  React UI        │    │   │  eth0   │  FORWARD   │   eth1    │  │
│  │  (Vite + React)  │    │   └─────────┘  chain     └───────────┘  │
│  └────────┬─────────┘    │        │                       │        │
│           │ HTTP         │        ▼                       ▼        │
│  ┌────────▼─────────┐    │   ┌─────────────────────────────────┐   │
│  │  Express.js API  │    │   │         netfilter / iptables     │   │
│  │  (port 5000)     │    │   │  sonaro-INPUT                    │   │
│  │                  │    │   │  sonaro-FORWARD                  │   │
│  │  /api/rpc/*      │    │   │  sonaro-NAT (POSTROUTING)        │   │
│  │  /api/data/*     │    │   │  sonaro-DNAT (PREROUTING)        │   │
│  │  /api/system/*   │    │   └─────────────────────────────────┘   │
│  └────────┬─────────┘    │                                          │
│           │              │   ┌──────────────────────────────────┐   │
│  ┌────────▼─────────┐    │   │         DAEMON LAYER             │   │
│  │   PostgreSQL     │    │   │  dnsmasq  strongSwan  suricata   │   │
│  │   (DrizzleORM)   │    │   │  keepalived  frrouting  tc       │   │
│  │   30+ tables     │    │   └──────────────────────────────────┘   │
│  └──────────────────┘    │                                          │
└──────────────────────────┴──────────────────────────────────────────┘
```

### 3.3 Linux Daemon Stack

Sonaro Gate orchestrates standard Ubuntu/Debian packages. The management console writes configuration to the database; the **apply** action generates daemon config files and reloads/restarts the appropriate service.

| Feature | Linux Daemon | Ubuntu Package |
|---------|-------------|----------------|
| Packet filtering | netfilter (kernel) | `iptables` |
| Interface config | Netplan | `netplan.io` |
| DHCP server | dnsmasq | `dnsmasq` |
| DNS server / resolver | dnsmasq or bind9 | `dnsmasq` / `bind9` |
| IPsec VPN | strongSwan | `strongswan` |
| WireGuard VPN | WireGuard kernel module | `wireguard-tools` |
| Dynamic routing | FRRouting (FRR) | `frr` |
| IDS/IPS | Suricata | `suricata` |
| High Availability | keepalived | `keepalived` |
| Traffic shaping | tc (HTB/TBF) | `iproute2` |
| Packet capture | tcpdump | `tcpdump` |
| TLS certificates | OpenSSL / certbot | `openssl` / `certbot` |
| NTP | systemd-timesyncd | (built-in) |

### 3.4 Network Data Flow

```
  Internet (upstream)
       │
  ┌────▼──────────────────────────┐
  │  WAN Interface (eth0)          │
  │  Public or ISP-assigned IP     │
  └────┬──────────────────────────┘
       │
  ┌────▼──────────────────────────────────────────────────────┐
  │               NETFILTER — PREROUTING                       │
  │   DNAT rules (Virtual IPs, port forwarding)                │
  └────┬──────────────────────────────────────────────────────┘
       │
  ┌────▼──────────────────────────────────────────────────────┐
  │               NETFILTER — FORWARD                          │
  │   sonaro-FORWARD chain                                     │
  │   Firewall policy rules (ACCEPT / DROP / REJECT)          │
  │   Connection tracking (conntrack)                          │
  └────┬──────────────────────────────────────────────────────┘
       │
  ┌────▼──────────────────────────────────────────────────────┐
  │               NETFILTER — POSTROUTING                      │
  │   MASQUERADE / SNAT rules                                  │
  └────┬──────────────────────────────────────────────────────┘
       │
  ┌────▼──────────────────────────┐
  │  LAN Interface (eth1)          │
  │  192.168.1.1/24 (default)     │
  └───────────────────────────────┘
       │
  LAN clients (dnsmasq DHCP, DNS)
```

### 3.5 Supported Platforms

| Deployment | Support Level | Notes |
|-----------|--------------|-------|
| Ubuntu 24.04 LTS bare-metal | **Fully Supported** | Recommended. Full iptables + Netplan. |
| Ubuntu 22.04 LTS bare-metal | Supported | Tested. Same daemon stack. |
| Proxmox VM (Ubuntu 24.04) | Supported | Requires `net.bridge.bridge-nf-call-iptables=1` |
| Docker (host network + privileged) | Supported | `network_mode: host` + `privileged: true` mandatory |
| Raspberry Pi 5 (Ubuntu 24.04 arm64) | Experimental | arm64 build; reduced throughput |
| AWS / GCP / Azure VM | Partial | iptables works; Netplan may conflict with cloud-init |

> **Note:** Running inside an unprivileged container (e.g., standard Docker without `--privileged`) disables all iptables operations. The console will start but show a warning: `NOT running as root — network commands disabled`.

---

## 4. System Requirements

### 4.1 Minimum Hardware

| Component | Minimum |
|-----------|---------|
| CPU | 2 cores, x86\_64, 64-bit |
| RAM | 2 GB |
| Storage | 20 GB SSD |
| Network Interfaces | 2 × Ethernet (WAN + LAN) |
| OS | Ubuntu 24.04 LTS |

### 4.2 Recommended Hardware

| Component | Recommended |
|-----------|------------|
| CPU | 4 cores, Intel/AMD, 2.5 GHz+ |
| RAM | 8 GB |
| Storage | 120 GB NVMe SSD |
| Network Interfaces | 4+ × 1 Gbps Ethernet |
| NIC | Intel i350 / i210 (excellent Linux driver support) |
| OS | Ubuntu 24.04 LTS Server (no GUI) |

> **Performance guidance:** With a 4-core CPU and 8 GB RAM, Sonaro Gate can sustain approximately 500 Mbps of stateful forwarding throughput with IDS disabled. Enabling Suricata IDS with full rule sets reduces throughput to approximately 200–300 Mbps on a 4-core system, as Suricata processes packets in software.

### 4.3 Software Prerequisites

The automated installer (`deploy/install.sh`) handles all of the following. Manual installation requires:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y \
  curl git nodejs npm postgresql \
  iptables iptables-persistent netplan.io \
  dnsmasq strongswan wireguard-tools frr \
  suricata tcpdump keepalived iproute2 \
  openssl certbot net-tools
```

Node.js version requirement: **≥ 20.x LTS**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 4.4 Network Interface Requirements

- **WAN interface:** One physical NIC connected to the upstream router or ISP modem. May be configured with a static IP, DHCP from ISP, or PPPoE (via Ubuntu's built-in pppd support).
- **LAN interface:** One or more physical NICs connected to internal network switches. Carries the default LAN subnet (default: `192.168.1.0/24`).
- **Management interface (optional):** A dedicated NIC or VLAN for accessing the web console. Recommended in production to prevent management traffic from being affected by firewall policies.

---

## 5. Getting Started

### 5.1 Automated Installation (Ubuntu 24.04 LTS)

The recommended way to install Sonaro Gate on a bare-metal Ubuntu 24.04 LTS server is to use the automated installer. The installer performs 7 steps:

1. Installs system packages (Node.js, PostgreSQL, dnsmasq, iptables, etc.)
2. Creates the `/opt/sonaro` application directory
3. Clones the repository and installs npm dependencies
4. Creates the PostgreSQL database and applies the schema
5. Creates the `sonaro.service` systemd unit
6. Enables `iptables-persistent` for rule persistence across reboots
7. Starts the service and runs the first-boot setup wizard

```bash
# Download and run the installer as root
curl -fsSL https://raw.githubusercontent.com/your-org/sonaro-gate/main/deploy/install.sh \
  | sudo bash
```

Or clone the repository first:

```bash
git clone https://github.com/your-org/sonaro-gate.git /opt/sonaro
cd /opt/sonaro
sudo bash deploy/install.sh
```

After installation, the systemd service runs automatically:

```bash
sudo systemctl status sonaro-fw
sudo systemctl enable sonaro-fw   # Enable on boot (installer does this)
```

### 5.2 First-Boot CLI Wizard

When Sonaro Gate starts for the first time as root on a TTY (no `setup_complete` key in the database), it launches an interactive CLI wizard. This wizard is modelled after pfSense's setup procedure.

```
╔══════════════════════════════════════════════╗
║      SONARO GATE 2025.1 LTS — Setup          ║
║      Next-Generation Firewall                ║
╚══════════════════════════════════════════════╝

Step 1: Hostname
  Current: ubuntu
  Enter hostname [press Enter to keep]: sonaro-gw-01

Step 2: WAN Interface
  Available interfaces:
    [0] eth0  — 00:11:22:33:44:55  (UP)
    [1] eth1  — 00:11:22:33:44:66  (UP)
    [2] eth2  — 00:11:22:33:44:77  (DOWN)
  Select WAN interface [0]: 0
  WAN IP configuration: (dhcp/static) [dhcp]: dhcp

Step 3: LAN Interface
  Select LAN interface [1]: 1
  LAN IP address [192.168.1.1]: 192.168.1.1
  LAN subnet mask [255.255.255.0]: 255.255.255.0

Step 4: Admin Password
  Enter new admin password: ********
  Confirm password:         ********

Step 5: Summary
  Hostname:      sonaro-gw-01
  WAN:           eth0 (DHCP)
  LAN:           eth1 — 192.168.1.1/24
  Web Console:   http://192.168.1.1:5000
  Admin:         admin@sonaro.local

  Apply configuration? [Y/n]: Y

[✓] Netplan config written to /etc/netplan/90-sonaro.yaml
[✓] Netplan applied
[✓] IP forwarding enabled
[✓] iptables NAT masquerade rule applied
[✓] Settings saved to database
[✓] Setup complete!
```

To re-run the wizard manually:

```bash
sudo systemctl stop sonaro-fw
sudo FORCE_SETUP=1 npx tsx /opt/sonaro/server/index.ts
```

### 5.3 Accessing the Web Management Console

After setup, open a browser on a LAN-connected device and navigate to:

```
http://<LAN_IP>:5000
```

Default: `http://192.168.1.1:5000`

The console is served by the Express.js backend which also serves the Vite-compiled React frontend. There is no separate web server (nginx/Apache) required.

> **Tip:** In production, place nginx as a reverse proxy in front of port 5000 to add HTTPS:
> ```nginx
> server {
>     listen 443 ssl;
>     server_name firewall.example.com;
>     ssl_certificate /etc/ssl/sonaro/cert.pem;
>     ssl_certificate_key /etc/ssl/sonaro/key.pem;
>     location / { proxy_pass http://127.0.0.1:5000; }
> }
> ```

### 5.4 Initial Login and Password Change

| Field | Default Value |
|-------|--------------|
| Email | `admin@sonaro.local` |
| Password | `Admin123!` |

> **Warning:** Change the default password immediately after first login. Navigate to **System → System Settings → Admin Password**.

### 5.5 Configuration via Docker

For testing, lab environments, or containerized deployments:

```bash
# Clone the repository
git clone https://github.com/your-org/sonaro-gate.git
cd sonaro-gate

# Copy and edit environment file
cp .env.example .env
# Edit .env: set DATABASE_URL, JWT_SECRET, POSTGRES_PASSWORD

# Start services
docker compose up -d
```

**Critical Docker requirements:**

```yaml
# docker-compose.yml (excerpt)
services:
  sonaro-fw:
    privileged: true          # Required for iptables
    network_mode: host        # Required for real packet forwarding
    cap_add:
      - NET_ADMIN
      - NET_RAW
      - SYS_ADMIN
```

> **Warning:** `privileged: true` grants the container full access to the host kernel. Use only in trusted environments. Never run with `privileged: true` on a shared container host.

Without `privileged: true`, iptables operations will fail silently and the console will display: `NOT running as root — network commands disabled`.

### 5.6 Verifying System Status

After startup, verify the system is operational:

**From the systemd journal:**

```bash
sudo journalctl -u sonaro-fw -f
```

Expected output:

```
[Seed] Admin user already exists, skipping seed.
[Agent] Starting system data collector...
[Agent] Collector running — metrics will update every 30s
[Agent] Serial number: SGW-001122334455
[Server] Sonaro Gate backend running on port 5000
[Server] Mode: production
[Server] ✓ Running as root — network commands enabled
[Server] ✓ ip_forward = 1 (routing ON)
```

**From the CLI console (web UI):**

```
admin@sonaro:~$ status
System Status:   ONLINE
Hostname:        sonaro-gw-01
Model:           Sonaro Gate 2025.1 LTS
Serial:          SGW-001122334455
Uptime:          2d 3h 14m 22s
CPU Usage:       12.4%   Load: 0.21 / 0.18 / 0.15
Memory:          1.2 GB / 8.0 GB  (15%)
Disk:            18 GB / 120 GB  (15%)
Threat Level:    LOW
```

---

## 6. Dashboard

The Dashboard (`/`) is the first page displayed after login. It provides a real-time overview of system health and network activity.

### 6.1 Resource Usage Widgets

| Widget | Data Source | Update Frequency |
|--------|-------------|-----------------|
| CPU Usage | `system_metrics.cpu_usage` | Every 30 seconds |
| Memory Usage | `system_metrics.memory_used / memory_total` | Every 30 seconds |
| Disk Usage | `system_metrics.disk_used / disk_total` | Every 30 seconds |
| System Uptime | `system_metrics.uptime` | Every 30 seconds |
| Load Average | `system_metrics.load_1m / load_5m / load_15m` | Every 30 seconds |

The background agent (`server/agent.ts`) collects these metrics using the `systeminformation` npm package and writes them to the `system_metrics` PostgreSQL table.

### 6.2 Traffic Overview

The Traffic Overview widget displays inbound, outbound, and blocked traffic per interface, sourced from the `traffic_stats` table. Traffic statistics are collected by sampling `/proc/net/dev` via `systeminformation`.

### 6.3 Threat Summary

Displays a count of threats detected in the last 24 hours, sourced from the `incidents` table. Populated by the Suricata IDS integration (see [Section 15](#15-ids--ips)).

### 6.4 Auto-Refresh Behavior

The Dashboard uses **TanStack Query `refetchInterval: 30000`** for all data queries. This means data is automatically refreshed every 30 seconds without any user interaction.

There is no manual refresh toggle. The header displays:

```
Last updated · updates every 30s
```

---

## 7. Network Interfaces

### 7.1 Viewing Interfaces

Navigate to **Network → Interfaces** to view all physical and virtual network interfaces.

The interface list is fetched live from the OS via:

```
GET /api/system/interfaces
```

This endpoint executes `ip -j addr show` on the server and returns a JSON array of interface objects including:

- Interface name (`ifname`)
- Operational state (`operstate`: `up` / `down` / `unknown`)
- IP addresses (`addr_info`)
- MAC address (`address`)
- MTU
- RX/TX byte counters

### 7.2 Editing Interface Settings

Click an interface row to open the edit panel. You can configure:

| Field | Description |
|-------|-------------|
| IP Address | Static IPv4 address (CIDR notation, e.g., `192.168.1.1/24`) |
| Gateway | Default gateway for this interface |
| MTU | Maximum Transmission Unit (default: 1500) |
| Description | Human-readable label |
| DHCP Client | If enabled, obtain IP from upstream DHCP server |

Changes are stored in the `interfaces` database table and applied to the OS by clicking **Apply Configuration**.

### 7.3 Applying Configuration (Netplan)

When you click **Apply Configuration** in the web console, the backend:

1. Reads all interface records from the `interfaces` table
2. Generates a Netplan YAML file at `/etc/netplan/90-sonaro.yaml`
3. Executes `netplan apply`

**Example generated Netplan configuration:**

```yaml
# /etc/netplan/90-sonaro.yaml
# Generated by Sonaro Gate 2025.1 LTS — do not edit manually
network:
  version: 2
  renderer: networkd
  ethernets:
    eth0:
      dhcp4: true
      optional: true
    eth1:
      addresses:
        - 192.168.1.1/24
      nameservers:
        addresses: [8.8.8.8, 1.1.1.1]
```

> **Warning:** Applying interface configuration on a remote session may temporarily disconnect you if the management interface IP address changes. Always have console (out-of-band) access when changing management interface settings in production.

The original Netplan file is backed up before overwrite:

```bash
/etc/netplan/90-sonaro.yaml.bak.<timestamp>
```

### 7.4 Interface Assignment

Navigate to **Network → Interface Assignment** to assign roles to physical interfaces.

Available roles:

| Role | Description |
|------|-------------|
| WAN | Upstream interface (internet-facing). NAT masquerade is applied here. |
| LAN | Internal network interface. DHCP server listens here. |
| DMZ | Demilitarized zone interface. Restricted firewall policy. |
| Management | Dedicated management interface. Not part of forwarding plane. |

### 7.5 VLAN Sub-Interfaces

Sonaro Gate supports IEEE 802.1Q VLAN sub-interfaces. To create a VLAN:

1. Navigate to **Network → Interfaces**
2. Click **Add VLAN**
3. Select the parent physical interface
4. Enter the VLAN ID (1–4094)
5. Assign an IP address
6. Click **Save**, then **Apply Configuration**

The Netplan YAML for VLAN sub-interfaces:

```yaml
network:
  version: 2
  ethernets:
    eth1: {}
  vlans:
    eth1.100:
      id: 100
      link: eth1
      addresses:
        - 10.100.0.1/24
```

### 7.6 Enabling IP Forwarding

IP forwarding must be enabled for the firewall to route packets between interfaces.

**Via the web console:**

Navigate to **Network → Interfaces** and verify the **IP Forwarding** status indicator. If disabled, click **Enable IP Forwarding**.

**This executes:**

```bash
echo 1 > /proc/sys/net/ipv4/ip_forward
# and persists via:
sysctl -w net.ipv4.ip_forward=1
echo 'net.ipv4.ip_forward=1' >> /etc/sysctl.d/99-sonaro.conf
```

**Verify:**

```bash
cat /proc/sys/net/ipv4/ip_forward
# Expected output: 1
```

---

## 8. Firewall Policies

### 8.1 Policy Architecture

Sonaro Gate uses **iptables** with a dedicated custom chain named `sonaro-FORWARD` for firewall policies. The chain is inserted into the kernel's `FORWARD` chain:

```
FORWARD chain (kernel default)
  └── sonaro-FORWARD  (Sonaro Gate custom chain)
        ├── Rule 1: LAN → WAN  TCP:80,443  ACCEPT
        ├── Rule 2: LAN → WAN  ALL         ACCEPT
        ├── Rule 3: WAN → DMZ  TCP:443     ACCEPT
        ├── Rule N: ...
        └── Default policy: DROP
```

Rules are stored in the `firewall_rules` database table and applied to the kernel via `POST /api/system/apply-all-rules`.

### 8.2 Creating a Firewall Rule

Navigate to **Firewall → Firewall Rules** and click **Add Rule**.

| Field | Description | Example |
|-------|-------------|---------|
| Name | Human-readable rule name | `Allow LAN to WAN HTTP` |
| Source | Source address or alias | `192.168.1.0/24` or alias name |
| Destination | Destination address or alias | `0.0.0.0/0` (any) |
| Service | Protocol and port(s) | `HTTP`, `HTTPS`, `custom:TCP:8080` |
| Action | `ACCEPT`, `DROP`, `REJECT` | `ACCEPT` |
| Log | Log matched packets to syslog | Enabled / Disabled |
| Schedule | Apply rule only during schedule | `Business Hours` |
| Enabled | Whether the rule is active | Yes / No |

After saving, click **Apply Rules to Kernel** to write the changes to iptables.

### 8.3 Rule Ordering and Priority

Rules are evaluated in ascending `position` order (1 = highest priority). The first matching rule wins. Rules with lower position numbers are evaluated first.

To reorder rules, drag rows in the **Firewall Rules** table or use the position field. After reordering, click **Apply Rules to Kernel**.

> **Best practice:** Place more specific rules before more general rules. For example:
> - Rule 10: `REJECT` WAN → LAN on TCP:22 (block SSH from WAN)
> - Rule 20: `ACCEPT` LAN → WAN on ALL

### 8.4 Services and Port Groups

Navigate to **Firewall → Services** to manage reusable service objects.

| Built-in service | Protocol | Port |
|-----------------|----------|------|
| HTTP | TCP | 80 |
| HTTPS | TCP | 443 |
| DNS | UDP/TCP | 53 |
| SSH | TCP | 22 |
| RDP | TCP | 3389 |
| SMTP | TCP | 25 |
| IMAP | TCP | 143 |
| FTP | TCP | 21 |
| NTP | UDP | 123 |
| ICMP | ICMP | — |

Custom services can be created with arbitrary protocol (TCP/UDP/ICMP/ANY) and port ranges.

### 8.5 Schedules

Navigate to **Firewall → Schedules** to define time-based rule activation windows.

| Field | Description |
|-------|-------------|
| Name | Schedule name (e.g., `Business Hours`) |
| Days | Day-of-week bitmask (Mon–Sun) |
| Start Time | HH:MM (24-hour) |
| End Time | HH:MM (24-hour) |

Schedules are evaluated at rule-match time by the Sonaro Gate daemon. The iptables `-m time` extension is used to implement time-based matching in the kernel.

### 8.6 Aliases (Address Objects)

Navigate to **Firewall → Aliases** to create reusable address objects.

| Type | Description | Example value |
|------|-------------|---------------|
| IP | Single IP address | `203.0.113.5` |
| Network | CIDR network | `10.0.0.0/8` |
| Range | IP range | `192.168.1.100-192.168.1.200` |
| FQDN | Hostname (resolved at rule apply time) | `api.example.com` |

### 8.7 Wildcard FQDN Objects

Navigate to **Firewall → Wildcard FQDN** for wildcard hostname matching (e.g., `*.example.com`).

> **Implementation note:** FQDN and Wildcard FQDN matching in iptables requires the `xt_string` or `ipset` approach. Sonaro Gate resolves FQDNs at apply time and inserts resolved IP addresses into `ipset` sets, which are then referenced by iptables rules. The resolved IPs are refreshed every 5 minutes.

### 8.8 Applying Rules to the Kernel (iptables)

When you click **Apply Rules to Kernel** in the web console, the backend:

1. Flushes the `sonaro-FORWARD` chain: `iptables -F sonaro-FORWARD`
2. Reads all enabled rules from the `firewall_rules` table (ordered by `position`)
3. Generates an iptables command for each rule
4. Executes each command via `exec`
5. Saves rules for persistence: `iptables-save > /etc/iptables/rules.v4`

Example generated iptables rule:

```bash
iptables -A sonaro-FORWARD \
  -s 192.168.1.0/24 \
  -d 0.0.0.0/0 \
  -p tcp --dport 443 \
  -j ACCEPT \
  -m comment --comment "Rule-uuid:allow-lan-https"
```

---

## 9. NAT and IP Masquerading

### 9.1 NAT Architecture on Ubuntu

Sonaro Gate implements NAT using the iptables `nat` table with dedicated custom chains:

```
nat table:
  PREROUTING  → sonaro-DNAT   (Destination NAT, port forwarding)
  POSTROUTING → sonaro-NAT    (Source NAT / masquerade)
```

### 9.2 Configuring Outbound NAT (Masquerade)

Navigate to **Firewall → NAT** to view and manage NAT rules.

**Enable outbound NAT (internet access for LAN):**

1. Click **Add NAT Rule**
2. Set type to **MASQUERADE**
3. Source: `192.168.1.0/24` (your LAN subnet)
4. Outbound interface: `eth0` (your WAN interface)
5. Click **Save → Apply NAT Rules**

This generates:

```bash
iptables -t nat -A sonaro-NAT \
  -s 192.168.1.0/24 \
  -o eth0 \
  -j MASQUERADE
```

### 9.3 Virtual IP (DNAT / Port Forwarding)

Navigate to **Network → Virtual IPs** to configure Destination NAT (port forwarding from WAN to an internal server).

| Field | Description | Example |
|-------|-------------|---------|
| External IP | WAN IP to receive connections | `203.0.113.1` or `0.0.0.0` (any) |
| External Port | Port on the WAN side | `443` |
| Internal IP | Server IP on LAN/DMZ | `192.168.1.100` |
| Internal Port | Port on the server | `443` |
| Protocol | TCP / UDP | `TCP` |

Generated iptables rule:

```bash
iptables -t nat -A sonaro-DNAT \
  -i eth0 \
  -p tcp --dport 443 \
  -j DNAT --to-destination 192.168.1.100:443
```

### 9.4 IP Pools (SNAT)

Navigate to **Firewall → IP Pools** for static SNAT (mapping LAN traffic to a specific public IP rather than masquerade).

```bash
iptables -t nat -A sonaro-NAT \
  -s 192.168.1.0/24 \
  -o eth0 \
  -j SNAT --to-source 203.0.113.5
```

### 9.5 Applying NAT Rules

Click **Apply NAT Rules** after any change to NAT configuration. This executes:

```
POST /api/system/apply-nat-rules
```

The backend flushes and rebuilds the `sonaro-NAT` and `sonaro-DNAT` chains from the database.

---

## 10. Routing

### 10.1 Static Routes

Navigate to **Network → Static Routes** to add static IPv4 routes.

| Field | Description | Example |
|-------|-------------|---------|
| Destination | Target network (CIDR) | `10.50.0.0/24` |
| Gateway | Next-hop IP address | `192.168.1.254` |
| Interface | Outbound interface | `eth1` |
| Metric | Route preference (lower = preferred) | `10` |
| Description | Human-readable label | `Branch office` |

When saved and applied, the backend executes:

```bash
ip route add 10.50.0.0/24 via 192.168.1.254 dev eth1 metric 10
```

Static routes are persisted via Netplan (`routes:` section) so they survive reboots.

### 10.2 Policy-Based Routing (PBR)

Navigate to **Network → Policy Routes** to configure traffic that should be routed differently based on source IP, destination IP, or protocol.

Policy routes use `ip rule` and custom routing tables:

```bash
# Create custom routing table
echo "200 sonaro-pbr" >> /etc/iproute2/rt_tables

# Add route to custom table
ip route add default via 10.0.0.1 table sonaro-pbr

# Add rule to use custom table for matching traffic
ip rule add from 192.168.2.0/24 table sonaro-pbr priority 100
```

### 10.3 Dynamic Routing with FRRouting

Sonaro Gate integrates with **FRRouting (FRR)** for dynamic routing protocols. FRR must be installed separately:

```bash
sudo apt install frr
sudo systemctl enable frr
```

Navigate to **Network → Routing** to view the current routing table and configure FRR daemons.

FRR daemon configuration files are located at `/etc/frr/`. Sonaro Gate generates and writes FRR configuration from the database when you click **Apply Dynamic Routing**.

> **Note:** FRR daemons (zebra, ospfd, bgpd, ripd) must be enabled individually in `/etc/frr/daemons` before starting.

### 10.4 OSPF Configuration

Navigate to **Network → OSPF** to configure Open Shortest Path First routing.

| Field | Description |
|-------|-------------|
| Router ID | OSPF Router ID (e.g., `10.0.0.1`) |
| Area | OSPF area (e.g., `0.0.0.0` for backbone) |
| Network | Network to advertise (e.g., `192.168.1.0/24`) |
| Hello Interval | OSPF hello packet interval (seconds) |
| Dead Interval | Neighbor dead interval (seconds) |

Generated `/etc/frr/ospfd.conf`:

```
router ospf
  ospf router-id 10.0.0.1
  network 192.168.1.0/24 area 0.0.0.0
  network 10.0.0.0/30 area 0.0.0.0
  passive-interface eth1
```

### 10.5 BGP Configuration

Navigate to **Network → BGP** to configure Border Gateway Protocol.

| Field | Description |
|-------|-------------|
| Local AS | Your BGP Autonomous System number |
| Router ID | BGP Router ID |
| Neighbor IP | BGP peer IP address |
| Neighbor AS | BGP peer AS number |
| Networks | Networks to advertise |

Generated `/etc/frr/bgpd.conf`:

```
router bgp 65001
  bgp router-id 10.0.0.1
  neighbor 10.0.0.2 remote-as 65002
  neighbor 10.0.0.2 description "Upstream ISP"
  !
  address-family ipv4 unicast
    network 203.0.113.0/24
    neighbor 10.0.0.2 activate
  exit-address-family
```

### 10.6 RIP Configuration

Navigate to **Network → RIP** for legacy RIPv2 routing.

> **Note:** RIP is provided for compatibility with legacy environments. For new deployments, prefer OSPF or BGP.

### 10.7 Viewing the Routing Table

Navigate to **Network → Routing** to view the live OS routing table. This fetches:

```
GET /api/system/routes
```

Which executes `ip -j route show` and returns JSON. Also accessible from the CLI console:

```
admin@sonaro:~$ routes
```

---

## 11. VPN

### 11.1 VPN Overview

Sonaro Gate supports two VPN technologies:

| Technology | Daemon | Use Case |
|-----------|--------|----------|
| IPsec (IKEv1/IKEv2) | strongSwan | Site-to-site tunnels, compatibility with commercial firewalls (FortiGate, Cisco, Palo Alto) |
| WireGuard | wireguard-tools / kernel module | Modern lightweight tunnels, remote access, high performance |

VPN tunnels are managed via **VPN → IPsec Tunnels** and **VPN → WireGuard**.

> **Package requirement:**
> ```bash
> sudo apt install strongswan          # IPsec
> sudo apt install wireguard-tools     # WireGuard
> ```

### 11.2 IPsec with strongSwan

Sonaro Gate generates strongSwan configuration files from the database.

Generated files:
- `/etc/ipsec.conf` — connection definitions
- `/etc/ipsec.secrets` — pre-shared keys and certificates

After applying, the backend executes:

```bash
sudo ipsec restart
```

Or for incremental updates:

```bash
sudo ipsec rereadall
sudo ipsec reload
```

### 11.3 Configuring an IPsec Site-to-Site Tunnel

Navigate to **VPN → IPsec Tunnels → Add Tunnel**.

| Field | Description | Example |
|-------|-------------|---------|
| Name | Tunnel identifier | `HQ-Branch1` |
| Local Gateway | WAN IP of this firewall | `203.0.113.1` |
| Remote Gateway | WAN IP of remote firewall | `203.0.113.50` |
| Local Subnet | LAN subnet of this site | `192.168.1.0/24` |
| Remote Subnet | LAN subnet of remote site | `10.50.0.0/24` |
| IKE Version | `IKEv2` (recommended) or `IKEv1` | `IKEv2` |
| Authentication | `PSK` or `Certificate` | `PSK` |
| Pre-Shared Key | Shared secret | (strong random string) |
| Phase 1 Encryption | IKE cipher | `AES-256-GCM` |
| Phase 2 Encryption | ESP cipher | `AES-256-GCM` |
| DH Group | Diffie-Hellman group | `Group 14 (2048-bit)` |
| Lifetime | SA lifetime (seconds) | `86400` |

Generated `/etc/ipsec.conf` entry:

```
conn HQ-Branch1
    keyexchange=ikev2
    left=203.0.113.1
    leftsubnet=192.168.1.0/24
    right=203.0.113.50
    rightsubnet=10.50.0.0/24
    authby=secret
    auto=start
    ike=aes256gcm16-sha256-modp2048!
    esp=aes256gcm16-sha256!
    ikelifetime=86400s
    lifetime=3600s
```

**Verify tunnel status:**

```bash
sudo ipsec status
sudo ipsec statusall | grep HQ-Branch1
```

### 11.4 WireGuard VPN

WireGuard provides a modern, high-performance alternative to IPsec. It uses Curve25519 key pairs for authentication.

**Generate a key pair:**

```bash
wg genkey | tee /etc/wireguard/private.key | wg pubkey > /etc/wireguard/public.key
chmod 600 /etc/wireguard/private.key
```

### 11.5 Configuring a WireGuard Tunnel

Navigate to **VPN → WireGuard → Add Interface**.

| Field | Description |
|-------|-------------|
| Interface Name | e.g., `wg0` |
| Listen Port | UDP port (default: 51820) |
| Private Key | Server private key |
| Address | Tunnel IP (e.g., `10.200.0.1/24`) |

**Add a peer:**

| Field | Description |
|-------|-------------|
| Peer Public Key | Remote peer's public key |
| Allowed IPs | Subnets routed through this peer |
| Endpoint | Remote peer's IP:port |
| Persistent Keepalive | Seconds between keepalives (for NAT traversal) |

Generated `/etc/wireguard/wg0.conf`:

```ini
[Interface]
PrivateKey = <server-private-key>
Address = 10.200.0.1/24
ListenPort = 51820

[Peer]
PublicKey = <peer-public-key>
AllowedIPs = 10.200.0.2/32, 10.50.0.0/24
Endpoint = 203.0.113.50:51820
PersistentKeepalive = 25
```

**Apply:**

```bash
sudo wg-quick up wg0
sudo systemctl enable wg-quick@wg0  # Persist across reboots
```

### 11.6 VPN Monitoring

Navigate to **VPN → VPN Status** to view real-time tunnel status. The CLI console also supports:

```
admin@sonaro:~$ vpn status
```

For strongSwan diagnostic output:

```bash
sudo ipsec statusall
sudo ip xfrm state
sudo ip xfrm policy
```

---

## 12. DHCP Server

### 12.1 DHCP Architecture (dnsmasq)

Sonaro Gate uses **dnsmasq** as the combined DHCP and DNS server. dnsmasq listens on the LAN interface(s) and distributes IP addresses from configured pools.

> **Prerequisite:**
> ```bash
> sudo apt install dnsmasq
> sudo systemctl enable dnsmasq
> ```

Sonaro Gate generates `/etc/dnsmasq.d/sonaro-dhcp.conf` from the database and reloads dnsmasq via `SIGHUP`:

```bash
kill -HUP $(cat /var/run/dnsmasq/dnsmasq.pid)
```

### 12.2 Configuring a DHCP Server

Navigate to **Network → DHCP Server → Add Server**.

| Field | Description | Example |
|-------|-------------|---------|
| Interface | LAN interface to serve DHCP | `eth1` |
| Range Start | First IP to lease | `192.168.1.100` |
| Range End | Last IP to lease | `192.168.1.200` |
| Lease Time | Lease duration | `24h` |
| Gateway | Default gateway pushed to clients | `192.168.1.1` |
| DNS Servers | DNS servers pushed to clients | `192.168.1.1, 8.8.8.8` |
| Domain | DHCP domain name | `sonaro.local` |
| Enabled | Whether this server is active | Yes / No |

Generated dnsmasq configuration:

```ini
# /etc/dnsmasq.d/sonaro-dhcp.conf
interface=eth1
dhcp-range=192.168.1.100,192.168.1.200,24h
dhcp-option=3,192.168.1.1     # Default gateway
dhcp-option=6,192.168.1.1     # DNS server
dhcp-option=15,sonaro.local   # Domain
```

### 12.3 Static IP Mappings (Reservations)

Navigate to **Network → DHCP Server → Static Mappings** to assign a fixed IP to a specific MAC address.

| Field | Description |
|-------|-------------|
| MAC Address | Client MAC address (e.g., `aa:bb:cc:dd:ee:ff`) |
| IP Address | Fixed IP to assign |
| Hostname | Client hostname (optional) |
| Description | Label |

Generated dnsmasq entry:

```ini
dhcp-host=aa:bb:cc:dd:ee:ff,192.168.1.50,printserver
```

### 12.4 Viewing Active Leases

Navigate to **Network → DHCP Server → Leases** to view all active DHCP leases. Lease data is read from `/var/lib/misc/dnsmasq.leases` and stored in the `dhcp_leases` database table.

---

## 13. DNS Server

### 13.1 DNS Architecture

Sonaro Gate uses **dnsmasq** as the primary DNS server. It handles:

1. **Forwarding** — Resolves external domains by forwarding queries to upstream DNS servers
2. **Local records** — Answers queries for internal hostnames from a local database
3. **DNS filtering** — Blocks queries for domains in blocklists (similar to pi-hole)

### 13.2 Forward Zones

Navigate to **DNS Server → Forward Zones** to configure upstream DNS resolvers per domain.

| Field | Description | Example |
|-------|-------------|---------|
| Domain | Zone to forward (empty = all) | `example.com` |
| Upstream Servers | DNS server IPs | `8.8.8.8, 1.1.1.1` |
| DNSSEC | Validate DNSSEC signatures | Enabled / Disabled |
| Enabled | Active state | Yes |

**Forward all queries to Cloudflare + Google:**

```
Domain:    (empty — catch-all)
Upstream:  1.1.1.1, 8.8.8.8
DNSSEC:    Enabled
```

Generated dnsmasq configuration:

```ini
server=8.8.8.8
server=1.1.1.1
server=/internal.corp/192.168.1.5   # Forward internal.corp to internal DNS
```

### 13.3 Local DNS Records

Navigate to **DNS Server → Local Records** to add hostname-to-IP mappings for internal hosts.

| Field | Description | Example |
|-------|-------------|---------|
| Hostname | DNS name | `webserver.sonaro.local` |
| IP Address | Resolved IP | `192.168.1.100` |
| TTL | Time to live (seconds) | `300` |
| Type | `A` (IPv4) or `AAAA` (IPv6) | `A` |

Generated dnsmasq entries:

```ini
address=/webserver.sonaro.local/192.168.1.100
address=/ntp.sonaro.local/192.168.1.1
```

### 13.4 DNS Filter Profiles

Navigate to **DNS Server → Filter Profiles** to configure DNS-level content filtering.

| Option | Description |
|--------|-------------|
| Domain Filter | Enable blocklist-based domain filtering |
| Safe Search | Force safe search on Google, Bing, YouTube |
| YouTube Restrict | Force YouTube Restricted Mode |
| Log All Domains | Log every DNS query to the system log |

**Domain blocklists** are stored in the `dns_filter_profiles` table and applied as dnsmasq `address=/<domain>/#` entries (returns NXDOMAIN for blocked domains).

Safe search enforcement uses dnsmasq `cname` entries to rewrite Google/Bing to their safe-search endpoints:

```ini
cname=www.google.com,forcesafesearch.google.com
cname=www.google.co.uk,forcesafesearch.google.com
cname=www.bing.com,strict.bing.com
```

---

## 14. Traffic Shaping and QoS

### 14.1 Traffic Shapers

Navigate to **Firewall → Traffic Shapers** to define bandwidth shaper classes.

| Field | Description | Example |
|-------|-------------|---------|
| Name | Shaper identifier | `LAN-Upload-10M` |
| Guaranteed Rate | Minimum guaranteed bandwidth | `2 Mbps` |
| Maximum Rate | Bandwidth ceiling | `10 Mbps` |
| Burst | Burst allowance | `15 Mbps` |
| Priority | Scheduling priority (1–7) | `3` |
| Interface | Interface to apply on | `eth0` |

### 14.2 Traffic Shaping Policies

Navigate to **Firewall → Traffic Shaping Policies** to bind shapers to traffic flows.

| Field | Description |
|-------|-------------|
| Source | Source address |
| Destination | Destination address |
| Service | Protocol/port |
| Shaper | Assigned traffic shaper |
| Direction | Inbound / Outbound |

### 14.3 tc/HTB Implementation on Ubuntu

Sonaro Gate implements QoS using **tc (traffic control)** with the **HTB (Hierarchical Token Bucket)** queueing discipline.

**Example generated tc commands:**

```bash
# Create root qdisc
tc qdisc add dev eth0 root handle 1: htb default 30

# Create root class with total bandwidth
tc class add dev eth0 parent 1: classid 1:1 htb rate 100mbit

# Create sub-class for high-priority traffic
tc class add dev eth0 parent 1:1 classid 1:10 htb rate 10mbit ceil 100mbit prio 1

# Create filter to assign traffic to class
tc filter add dev eth0 parent 1: protocol ip prio 1 u32 \
  match ip dst 192.168.1.100/32 flowid 1:10
```

---

## 15. IDS / IPS

### 15.1 Suricata Overview

Sonaro Gate integrates with **Suricata** as its Intrusion Detection and Prevention System (IDS/IPS). Suricata inspects packet payloads against a signature rule database.

> **Prerequisite:**
> ```bash
> sudo apt install suricata
> sudo suricata-update              # Download Emerging Threats rule set
> sudo systemctl enable suricata
> ```

Suricata operates in two modes:

| Mode | Description |
|------|-------------|
| IDS (AF-PACKET) | Passive monitoring — copies packets from interface, generates alerts |
| IPS (NFQUEUE) | Inline mode — receives packets from iptables NFQUEUE, can drop |

**For IPS mode, add an iptables rule:**

```bash
iptables -A FORWARD -j NFQUEUE --queue-num 0
```

### 15.2 IDS Settings

Navigate to **Security → IDS/IPS Settings** to configure Suricata.

| Setting | Description |
|---------|-------------|
| Mode | `IDS` (monitoring) or `IPS` (inline blocking) |
| Interface | Interface to monitor (`eth0`, `eth1`, or `any`) |
| Rule Sets | Emerging Threats, Snort Community, Custom |
| Home Networks | Suricata `HOME_NET` variable |
| Action on Alert | `Alert Only` or `Drop + Alert` |
| Log Format | `eve-json` (default) |

Generated `/etc/suricata/suricata.yaml` (relevant sections):

```yaml
af-packet:
  - interface: eth0
    cluster-id: 99
    cluster-type: cluster_flow
    defrag: yes

HOME_NET: "[192.168.0.0/16,10.0.0.0/8,172.16.0.0/12]"

rule-files:
  - suricata.rules
  - /etc/suricata/rules/*.rules
```

### 15.3 Threat Monitor and Incidents

Navigate to **Security → Threat Monitor** to view real-time Suricata alerts.

Navigate to **Security → Incidents** for a historical log of detected incidents with severity, signature ID, source/destination IP, and timestamp.

Suricata writes alerts to `/var/log/suricata/eve.json` in JSON format. Sonaro Gate's agent reads this file and inserts new events into the `incidents` database table.

### 15.4 Signature Updates

Update Suricata rules via the CLI:

```bash
sudo suricata-update
sudo systemctl reload suricata
```

Or schedule automatic updates:

```bash
# /etc/cron.daily/suricata-update
#!/bin/bash
suricata-update && systemctl reload suricata
```

---

## 16. High Availability

### 16.1 HA Architecture (keepalived VRRP)

Sonaro Gate implements High Availability using **keepalived** with the **VRRP (Virtual Router Redundancy Protocol)** protocol. Two Sonaro Gate units share a virtual IP address. If the primary unit fails, the secondary unit takes over the virtual IP within seconds.

```
Internet
    │
    ├── Virtual IP: 203.0.113.1  ← shared by both units
    │
    ├── Primary:   203.0.113.2  (keepalived MASTER, priority 200)
    └── Secondary: 203.0.113.3  (keepalived BACKUP, priority 100)
```

> **Prerequisite:**
> ```bash
> sudo apt install keepalived
> sudo systemctl enable keepalived
> ```

### 16.2 Configuring HA

Navigate to **System → High Availability** to configure HA mode.

| Field | Description |
|-------|-------------|
| HA Mode | `Standalone` or `Active-Passive` |
| Role | `Master` or `Backup` |
| Virtual Router ID | VRID (1–255, must match on both units) |
| Virtual IP | Shared virtual IP address (CIDR) |
| Interface | Interface for VRRP advertisements |
| Priority | Master = 200, Backup = 100 |
| Password | VRRP authentication password |
| Peer IP | IP of the other HA unit |

Generated `/etc/keepalived/keepalived.conf`:

```
vrrp_instance VI_1 {
    state MASTER
    interface eth0
    virtual_router_id 51
    priority 200
    advert_int 1
    authentication {
        auth_type PASS
        auth_pass SonaroHA2025
    }
    virtual_ipaddress {
        203.0.113.1/24
    }
    notify_master "/opt/sonaro/scripts/ha-failover.sh master"
    notify_backup "/opt/sonaro/scripts/ha-failover.sh backup"
    notify_fault  "/opt/sonaro/scripts/ha-failover.sh fault"
}
```

### 16.3 Failover Behavior

When the primary unit fails (or keepalived detects a failure via track_interface/track_script):

1. Primary keepalived sends VRRP advertisement with priority 0 (or stops sending)
2. Secondary detects timeout (typically 3 × advert_int = 3 seconds)
3. Secondary transitions to MASTER state
4. Secondary brings up the virtual IP on its interface
5. Secondary sends a gratuitous ARP to update the network's ARP cache
6. Traffic is now routed to the secondary unit

**Failover time:** Typically 2–4 seconds with default `advert_int 1`.

### 16.4 HA Limitations on Ubuntu

- **Configuration synchronization** between the two units must be handled externally (e.g., via `rsync` + SSH, or a shared NFS mount for the database). Sonaro Gate does not perform automatic config sync between HA peers.
- **Session failover** (maintaining existing TCP connections across failover) requires `conntrackd`. Install and configure separately.
- **Database replication** requires either a shared PostgreSQL server (recommended) or PostgreSQL streaming replication between the two units.

```bash
# Recommended: Point both HA units to a shared external PostgreSQL server
DATABASE_URL=postgresql://sonaro:password@db.sonaro.local:5432/sonaro
```

---

## 17. Certificate Management

### 17.1 Generating Self-Signed Certificates

Navigate to **System → Certificates → Generate** to create a self-signed certificate for the web console.

Equivalent CLI command:

```bash
openssl req -x509 -newkey rsa:4096 -keyout /etc/ssl/sonaro/key.pem \
  -out /etc/ssl/sonaro/cert.pem -days 365 -nodes \
  -subj "/CN=sonaro-gw-01/O=Sonaro Gate/C=VN"
```

### 17.2 Importing CA / Intermediate Certificates

Navigate to **System → Certificates → Import** to upload:

- **CA Certificate** (PEM format) — trusted CA certificates for VPN peer authentication
- **Server Certificate** — certificate + private key for the web console
- **Intermediate CA** — chain certificates for full path validation

Certificates are stored in the `certificates` database table (PEM-encoded) and written to `/etc/ssl/sonaro/` on apply.

### 17.3 Let's Encrypt Integration

For publicly accessible management consoles, use Let's Encrypt for free TLS certificates:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d firewall.example.com
```

Set up automatic renewal:

```bash
sudo certbot renew --dry-run
# Renewal is handled automatically via /etc/cron.d/certbot
```

---

## 18. User and Access Management

### 18.1 Local User Accounts

Navigate to **System → User Groups → Users** to manage local user accounts.

| Field | Description |
|-------|-------------|
| Full Name | Display name |
| Email | Login username (must be valid email format) |
| Password | bcrypt-hashed password (min 12 characters) |
| Role | `admin`, `operator`, `read-only` |
| Enabled | Account active state |

Passwords are stored as **bcrypt** hashes (cost factor 12) in the `users` table. Plain-text passwords are never stored.

### 18.2 Admin Profiles and RBAC

Navigate to **System → Admin Profiles** to define Role-Based Access Control (RBAC) profiles.

| Permission | Admin | Operator | Read-Only |
|-----------|-------|----------|-----------|
| View all pages | ✓ | ✓ | ✓ |
| Modify firewall rules | ✓ | ✓ | — |
| Apply configuration | ✓ | ✓ | — |
| Manage users | ✓ | — | — |
| System backup/restore | ✓ | — | — |
| View logs | ✓ | ✓ | ✓ |

### 18.3 User Groups

Navigate to **System → User Groups** to organize users into groups for policy assignment.

### 18.4 JWT Authentication

All API requests require a valid JWT token.

**Obtain a token:**

```bash
curl -X POST http://192.168.1.1:5000/api/rpc/authenticate \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sonaro.local","password":"Admin123!"}'
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "admin@sonaro.local",
    "role": "admin"
  }
}
```

**Use the token:**

```bash
curl http://192.168.1.1:5000/api/data/firewall_rules \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

Token expiry: **24 hours**. Re-authenticate after expiry.

JWT secret is configured via the `JWT_SECRET` environment variable. In production, use a strong random value:

```bash
openssl rand -hex 64
```

---

## 19. System Administration

### 19.1 System Settings

Navigate to **System → System Settings** to configure:

| Setting | Description | Default |
|---------|-------------|---------|
| Hostname | System hostname | `sonaro-gw-01` |
| Admin Password | Web console admin password | `Admin123!` |
| Timezone | System timezone | `Asia/Ho_Chi_Minh` |
| NTP Server | Time synchronization server | `pool.ntp.org` |
| Management Port | Web console port | `5000` |
| WAN Interface | Primary WAN NIC name | (detected at setup) |
| LAN Interface | Primary LAN NIC name | (detected at setup) |

### 19.2 Backup and Restore

Navigate to **System → System Backup** to export the full system configuration.

**Backup content:**

The backup is a JSON file containing all database tables:

- Firewall rules, NAT rules, aliases, services, schedules
- Interface configuration
- Static and policy routes
- VPN tunnel configuration
- DHCP server and mappings
- DNS zones and local records
- System settings
- User accounts (passwords excluded from backup)

**Create a backup:**

```
GET /api/data/system_backup
→ Returns: sonaro-backup-<hostname>-<date>.json
```

**Automated backup (cron):**

```bash
# /etc/cron.daily/sonaro-backup
#!/bin/bash
DATE=$(date +%Y%m%d)
curl -s -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:5000/api/data/system_backup \
  -o /opt/sonaro/backups/backup-$DATE.json
```

### 19.3 Configuration Restore

Navigate to **System → Config Backup → Restore** and upload a previously exported JSON backup file.

> **Warning:** Restoring a configuration will overwrite all current settings. The system will re-apply iptables, Netplan, and daemon configurations after restore. Schedule this during a maintenance window.

### 19.4 Firmware Upgrade

To upgrade Sonaro Gate:

```bash
cd /opt/sonaro
sudo git fetch origin
sudo git pull origin main
npm install
npm run build
sudo systemctl restart sonaro-fw
```

Or using the installer:

```bash
sudo bash deploy/install.sh --upgrade
```

After upgrade, verify version:

```
admin@sonaro:~$ version
Sonaro Gate 2025.1 LTS (build 2025.04)
Hostname:  sonaro-gw-01
Serial:    SGW-001122334455
Kernel:    Linux 6.8 (Ubuntu 24.04 LTS)
```

### 19.5 System Logs

Navigate to **System → System Logs** to view logs from:

- **Firewall** — iptables LOG target entries from `/var/log/kern.log`
- **DHCP** — dnsmasq lease events from `/var/log/syslog`
- **DNS** — dnsmasq query log from `/var/log/syslog`
- **VPN** — strongSwan/WireGuard events from `/var/log/syslog`
- **IDS** — Suricata alerts from `/var/log/suricata/fast.log`
- **System** — systemd journal for `sonaro-fw` service

Logs are stored in the `system_logs` database table and are queryable via the PostgREST API.

### 19.6 Log Reports

Navigate to **System → Reports** for aggregated, time-bucketed reports:

- Top source IPs by traffic volume
- Top blocked destinations
- Top attack signatures (IDS)
- Daily/weekly/monthly traffic trends
- Protocol distribution

### 19.7 Packet Capture

Navigate to **Tools → Packet Capture** to capture live traffic on any interface.

**Backend implementation:**

```bash
tcpdump -i eth0 -w /tmp/capture.pcap -c 1000 "host 192.168.1.100"
```

> **Note:** Packet capture requires `sudo` (root). The resulting `.pcap` file can be downloaded and opened in Wireshark.

### 19.8 Rebooting and Shutdown

```bash
sudo systemctl stop sonaro-fw
sudo reboot

# Or shutdown
sudo shutdown -h now
```

> **Before reboot:** Ensure iptables rules are persisted:
> ```bash
> sudo iptables-save > /etc/iptables/rules.v4
> sudo ip6tables-save > /etc/iptables/rules.v6
> ```
> The `iptables-persistent` package handles this automatically on shutdown if installed.

---

## 20. CLI Reference

### 20.1 Built-in Web CLI Console

Access the CLI console by clicking the **terminal icon** (⌨) in the top-right header of the web console. The console opens as a floating overlay.

**Features:**
- Command history navigation with `↑` / `↓` arrow keys
- Tab completion for command names
- Real-time data fetching from the API backend
- GitHub Dark color scheme

### 20.2 SSH Console Access

For full shell access to the Ubuntu system:

```bash
ssh admin@192.168.1.1
```

The `sonaro-fw` process runs as root. You can manage it with:

```bash
sudo systemctl status sonaro-fw
sudo systemctl restart sonaro-fw
sudo journalctl -u sonaro-fw -f
```

### 20.3 CLI Command Reference

The following commands are available in the built-in web CLI console:

#### `help`
Display all available commands.

#### `status`
Display a comprehensive system status summary. Data is fetched live from the `system_metrics` database table.

```
System Status:   ONLINE
Hostname:        sonaro-gw-01
Model:           Sonaro Gate 2025.1 LTS
Serial:          SGW-001122334455
Uptime:          2d 3h 14m 22s
CPU Usage:       12.4%   Load: 0.21 / 0.18 / 0.15
Memory:          1.2 GB / 8.0 GB  (15%)
Disk:            18 GB / 120 GB  (15%)
Threat Level:    LOW
```

#### `cpu`
Display CPU utilization details from the OS.

```
CPU Usage:     12.4%
Cores:         4
Temperature:   48.0°C
Load Avg:      0.21 / 0.18 / 0.15  (1m / 5m / 15m)
```

#### `memory`
Display memory utilization.

```
Memory Total:  8.0 GB
Memory Used:   1.2 GB  (15%)
Memory Free:   5.8 GB
Memory Cached: 1.0 GB
```

#### `disk`
Display disk usage for the primary filesystem.

```
Filesystem   Size       Used       Free       Use%
/dev/sda1    120.0 GB   18.0 GB    102.0 GB   15%
```

#### `uptime`
Display system uptime.

```
System uptime: 2d 3h 14m 22s
```

#### `interfaces`
Display all network interfaces with their operational state, IP addresses, and traffic statistics. Data sourced from `/api/system/interfaces` (live OS data).

#### `routes`
Display the OS routing table. Data sourced from `/api/system/routes` (`ip route show`).

#### `firewall rules`
Display the first 20 firewall rules from the database.

#### `vpn status`
Display VPN tunnel status from the database.

#### `version`
Display Sonaro Gate version, hostname, and serial number.

#### `sessions`
Display a system metrics snapshot including resource utilization.

#### `dns lookup <host>`
Perform a simulated DNS lookup for the specified hostname.

```
admin@sonaro:~$ dns lookup api.example.com
Resolving api.example.com...
Name:       api.example.com
Address:    93.184.216.34
TTL:        3600s
Query time: 12ms
Server:     127.0.0.1#53 (local DNS)
```

#### `ping <host>`
Perform a simulated ICMP ping to the specified host.

> **Note:** Real ICMP ping requires `CAP_NET_RAW` capability or root. The web CLI simulates ping responses.

#### `clear`
Clear the console output buffer.

#### `exit`
Close the CLI console overlay.

---

## 21. REST API Reference

### 21.1 Authentication

```http
POST /api/rpc/authenticate
Content-Type: application/json

{
  "email": "admin@sonaro.local",
  "password": "Admin123!"
}
```

Response:

```json
{
  "token": "<jwt-token>",
  "user": { "id": "...", "email": "...", "role": "admin" }
}
```

All subsequent requests must include:

```http
Authorization: Bearer <jwt-token>
```

### 21.2 CRUD Endpoints

All database tables are exposed via PostgREST-compatible endpoints at `/api/data/<table>`.

**Supported query parameters:**

| Parameter | Description | Example |
|-----------|-------------|---------|
| `select` | Columns to return | `?select=id,name,action` |
| `order` | Sort order | `?order=position.asc` |
| `limit` | Max rows | `?limit=25` |
| `offset` | Skip rows | `?offset=50` |
| `<column>=eq.<value>` | Filter by equality | `?enabled=eq.true` |
| `<column>=like.<value>` | Filter by pattern | `?name=like.*http*` |

**Available tables:**

| Table | Description |
|-------|-------------|
| `firewall_rules` | Firewall policies |
| `nat_rules` | NAT rules |
| `aliases` | Address objects |
| `services` | Service port objects |
| `schedules` | Time-based schedules |
| `static_routes` | Static routing table |
| `policy_routes` | Policy-based routes |
| `interfaces` | Interface configuration |
| `vpn_tunnels` | VPN tunnel definitions |
| `dhcp_servers` | DHCP server configurations |
| `dhcp_mappings` | Static DHCP reservations |
| `dhcp_leases` | Active DHCP leases |
| `dns_forward_zones` | DNS forward zones |
| `dns_local_records` | Local DNS records |
| `dns_filter_profiles` | DNS filter profiles |
| `system_metrics` | OS metrics (read-only) |
| `system_settings` | Key-value settings |
| `users` | User accounts |
| `incidents` | IDS/IPS security incidents |
| `system_logs` | Aggregated system logs |
| `certificates` | TLS certificate store |

**GET (list):**
```http
GET /api/data/firewall_rules?order=position.asc&limit=50
```

**GET (single):**
```http
GET /api/data/firewall_rules?id=eq.<uuid>
```

**POST (create):**
```http
POST /api/data/firewall_rules
Content-Type: application/json

{
  "name": "Allow HTTPS",
  "source": "192.168.1.0/24",
  "destination": "0.0.0.0/0",
  "service": "HTTPS",
  "action": "ACCEPT",
  "enabled": true,
  "position": 10
}
```

**PATCH (update):**
```http
PATCH /api/data/firewall_rules?id=eq.<uuid>
Content-Type: application/json

{ "enabled": false }
```

**DELETE:**
```http
DELETE /api/data/firewall_rules?id=eq.<uuid>
```

### 21.3 System Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check (no auth) |
| `GET` | `/api/system/interfaces` | Live NIC list from OS |
| `GET` | `/api/system/interfaces/:name` | Single interface details |
| `POST` | `/api/system/interfaces/:name/apply` | Apply interface config |
| `POST` | `/api/system/interfaces/:name/state` | Enable/disable interface |
| `GET` | `/api/system/routes` | Live routing table from OS |
| `GET` | `/api/system/iptables` | Live iptables ruleset |
| `GET` | `/api/system/nftables` | Live nftables ruleset |
| `GET` | `/api/system/ip-forward` | Check IP forwarding status |
| `POST` | `/api/system/ip-forward/enable` | Enable IP forwarding |
| `POST` | `/api/system/apply-rule` | Apply single iptables rule |
| `POST` | `/api/system/apply-all-rules` | Rebuild iptables from DB |
| `POST` | `/api/system/apply-nat-rules` | Rebuild NAT rules from DB |
| `POST` | `/api/system/nat-masquerade` | Enable/disable masquerade |
| `POST` | `/api/system/apply-config` | Apply all (rules + NAT + interfaces) |
| `POST` | `/api/system/netplan/apply` | Apply Netplan configuration |

---

## 22. Troubleshooting

### 22.1 Firewall Rules Not Applying

**Symptom:** Traffic is blocked or allowed contrary to configured rules.

**Diagnosis:**

```bash
# Check iptables rules
sudo iptables -L sonaro-FORWARD -n -v --line-numbers

# Check if sonaro-FORWARD chain exists
sudo iptables -L | grep sonaro

# Check for stale rules
sudo iptables -t nat -L -n -v
```

**Resolution:**

1. In the web console, navigate to **Firewall → Firewall Rules**
2. Click **Apply Rules to Kernel**
3. Check the server log: `sudo journalctl -u sonaro-fw -n 50`

If the service is not running as root:

```bash
sudo systemctl stop sonaro-fw
sudo systemctl start sonaro-fw
```

**Verify IP forwarding:**

```bash
cat /proc/sys/net/ipv4/ip_forward
# Must be: 1
```

### 22.2 NAT / Internet Not Working

**Symptom:** LAN clients cannot reach the internet despite firewall rules.

**Diagnosis checklist:**

```bash
# 1. Check IP forwarding
cat /proc/sys/net/ipv4/ip_forward

# 2. Check NAT masquerade rule
sudo iptables -t nat -L sonaro-NAT -n -v

# 3. Check default route on the firewall
ip route show default

# 4. Test connectivity from the firewall itself
ping -c 3 8.8.8.8

# 5. Check for conntrack table full
sudo conntrack -L | wc -l
cat /proc/sys/net/netfilter/nf_conntrack_max
```

**Resolution:**

1. Re-apply NAT rules: **Firewall → NAT → Apply NAT Rules**
2. Verify WAN interface assignment: **Network → Interface Assignment**
3. Manually test: `curl --interface eth1 http://example.com`

### 22.3 DHCP Clients Not Receiving Addresses

**Diagnosis:**

```bash
sudo systemctl status dnsmasq
sudo journalctl -u dnsmasq -n 30
sudo cat /var/lib/misc/dnsmasq.leases
```

**Common causes:**

| Cause | Resolution |
|-------|-----------|
| dnsmasq not installed | `sudo apt install dnsmasq && sudo systemctl enable --now dnsmasq` |
| dnsmasq config syntax error | `sudo dnsmasq --test` |
| Another DHCP server on the same segment | Check for rogue DHCP servers: `sudo nmap --script broadcast-dhcp-discover` |
| Firewall blocking UDP 67/68 | Add rule: `ACCEPT INPUT interface=eth1 UDP dst=67` |

### 22.4 VPN Tunnels Not Establishing

**IPsec diagnosis:**

```bash
sudo ipsec status
sudo ipsec statusall
sudo journalctl -u strongswan -n 50

# Enable verbose debugging
sudo ipsec stroke loglevel ike 3
```

**Common IPsec issues:**

| Issue | Cause | Resolution |
|-------|-------|-----------|
| `NO_PROPOSAL_CHOSEN` | Phase 1 cipher mismatch | Match IKE cipher on both endpoints |
| `TS_UNACCEPTABLE` | Subnet mismatch | Verify local/remote subnet configuration |
| `AUTH_FAILED` | PSK mismatch | Verify pre-shared key on both sides |
| Connection refused | UDP 500/4500 blocked | Open UDP 500 and 4500 on WAN |

**WireGuard diagnosis:**

```bash
sudo wg show
sudo journalctl -k | grep wireguard
```

### 22.5 Web Console Not Accessible

**Diagnosis:**

```bash
# Check service status
sudo systemctl status sonaro-fw

# Check listening port
ss -tlnp | grep :5000

# Check firewall (INPUT chain)
sudo iptables -L INPUT -n | grep 5000
```

**Resolution:**

```bash
# Allow management port through firewall
sudo iptables -I INPUT -p tcp --dport 5000 -j ACCEPT

# Restart service
sudo systemctl restart sonaro-fw
```

### 22.6 IDS Not Detecting Threats

**Diagnosis:**

```bash
sudo systemctl status suricata
sudo suricata --build-info
sudo tail -f /var/log/suricata/fast.log
sudo tail -f /var/log/suricata/eve.json | python3 -m json.tool
```

**Test with a known signature trigger:**

```bash
# Triggers ET SCAN Nmap Scripting Engine User-Agent Detect
curl -A "nmap" http://192.168.1.1:5000/api/health
```

**Common issues:**

| Issue | Resolution |
|-------|-----------|
| No rules loaded | `sudo suricata-update && sudo systemctl reload suricata` |
| Interface not monitored | Verify `af-packet.interface` in `/etc/suricata/suricata.yaml` |
| Suricata not running | `sudo systemctl start suricata` |

---

## 23. Appendix

### 23.1 Daemon Matrix

| Feature | Required Daemon | Ubuntu Package | Auto-Started by Installer |
|---------|----------------|----------------|--------------------------|
| Firewall (iptables) | netfilter (kernel) | `iptables`, `iptables-persistent` | Yes |
| Interface config | Netplan → systemd-networkd | `netplan.io` | Yes |
| DHCP server | dnsmasq | `dnsmasq` | Yes |
| DNS server | dnsmasq | `dnsmasq` | Yes |
| IPsec VPN | strongSwan | `strongswan` | Yes |
| WireGuard VPN | wg-quick | `wireguard-tools` | Manual (`wg-quick@wg0`) |
| Dynamic routing | FRRouting | `frr` | Manual |
| IDS/IPS | Suricata | `suricata` | Yes |
| HA / VRRP | keepalived | `keepalived` | No (standalone default) |
| Traffic shaping | tc / iproute2 | `iproute2` | Yes (built-in) |
| Packet capture | tcpdump | `tcpdump` | Yes |
| NTP client | systemd-timesyncd | (built-in) | Yes |
| Certificates | OpenSSL / certbot | `openssl` | Yes |

### 23.2 Database Schema Summary

Sonaro Gate uses **PostgreSQL** with **Drizzle ORM** for schema management. The schema is defined in `shared/schema.ts`.

| Table | Primary Key | Description |
|-------|-------------|-------------|
| `users` | UUID | Admin user accounts |
| `system_settings` | UUID | Key-value system configuration |
| `system_metrics` | UUID | Periodic OS metrics (CPU/RAM/disk) |
| `traffic_stats` | UUID | Per-interface traffic counters |
| `interfaces` | UUID | Network interface configuration |
| `aliases` | UUID | Firewall address objects |
| `services` | UUID | Firewall service port objects |
| `schedules` | UUID | Time-based activation schedules |
| `wildcard_fqdns` | UUID | Wildcard FQDN address objects |
| `firewall_rules` | UUID | Stateful firewall policies |
| `nat_rules` | UUID | NAT / masquerade rules |
| `ip_pools` | UUID | SNAT IP pool definitions |
| `virtual_ips` | UUID | DNAT / port forwarding rules |
| `static_routes` | UUID | Static routing entries |
| `policy_routes` | UUID | Policy-based routing rules |
| `vpn_tunnels` | UUID | VPN tunnel definitions |
| `dhcp_servers` | UUID | DHCP server instances |
| `dhcp_mappings` | UUID | Static DHCP reservations |
| `dhcp_leases` | UUID | Active DHCP lease records |
| `dns_forward_zones` | UUID | DNS forwarding zones |
| `dns_local_records` | UUID | Local DNS A/AAAA records |
| `dns_filter_profiles` | UUID | DNS filtering policies |
| `traffic_shapers` | UUID | QoS shaper class definitions |
| `traffic_shaping_policies` | UUID | QoS policy assignments |
| `ids_settings` | UUID | Suricata IDS/IPS configuration |
| `incidents` | UUID | IDS/IPS security alerts |
| `ha_settings` | UUID | HA / keepalived configuration |
| `certificates` | UUID | TLS certificate store |
| `admin_profiles` | UUID | RBAC permission profiles |
| `user_groups` | UUID | User group definitions |
| `system_logs` | UUID | Aggregated system event logs |

**Apply schema changes:**

```bash
npx drizzle-kit push
```

### 23.3 Netplan Template Reference

Sonaro Gate generates the following Netplan file at `/etc/netplan/90-sonaro.yaml`:

```yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    eth0:
      dhcp4: true
      optional: true
    eth1:
      addresses:
        - 192.168.1.1/24
      nameservers:
        addresses:
          - 8.8.8.8
          - 1.1.1.1
  vlans:
    eth1.100:
      id: 100
      link: eth1
      addresses:
        - 10.100.0.1/24
```

> **Do not manually edit** `/etc/netplan/90-sonaro.yaml`. All changes should be made through the web console. Manual edits will be overwritten the next time **Apply Configuration** is clicked.

### 23.4 iptables Chain Architecture

```
filter table:
  INPUT
    └── sonaro-INPUT       (management access rules)
  FORWARD
    └── sonaro-FORWARD     (inter-zone forwarding rules)
  OUTPUT
    (managed by OS, not modified by Sonaro Gate)

nat table:
  PREROUTING
    └── sonaro-DNAT        (virtual IPs, port forwarding)
  POSTROUTING
    └── sonaro-NAT         (masquerade, SNAT)

mangle table:
  PREROUTING
    └── sonaro-MANGLE      (DSCP marking, traffic shaping marks)
```

**Custom chain initialization (run on startup):**

```bash
# Create chains if they don't exist
iptables -N sonaro-INPUT   2>/dev/null || true
iptables -N sonaro-FORWARD 2>/dev/null || true
iptables -N sonaro-DNAT    2>/dev/null || true
iptables -N sonaro-NAT     2>/dev/null || true
iptables -N sonaro-MANGLE  2>/dev/null || true

# Jump from built-in chains to sonaro chains
iptables -C INPUT      -j sonaro-INPUT   2>/dev/null || iptables -I INPUT      1 -j sonaro-INPUT
iptables -C FORWARD    -j sonaro-FORWARD 2>/dev/null || iptables -I FORWARD    1 -j sonaro-FORWARD
iptables -t nat -C PREROUTING  -j sonaro-DNAT 2>/dev/null || iptables -t nat -I PREROUTING  1 -j sonaro-DNAT
iptables -t nat -C POSTROUTING -j sonaro-NAT  2>/dev/null || iptables -t nat -I POSTROUTING 1 -j sonaro-NAT
```

### 23.5 Default Port Reference

| Port | Protocol | Service | Direction |
|------|----------|---------|-----------|
| 5000 | TCP | Sonaro Gate web console | Management → Firewall |
| 22 | TCP | SSH | Management → Firewall |
| 67, 68 | UDP | DHCP server | LAN clients → Firewall |
| 53 | UDP/TCP | DNS server | LAN clients → Firewall |
| 500 | UDP | IPsec IKE | WAN → Firewall |
| 4500 | UDP | IPsec NAT-T | WAN → Firewall |
| 51820 | UDP | WireGuard | WAN → Firewall |
| 2049 | TCP | Suricata rule updates (HTTPS) | Firewall → Internet |
| 123 | UDP | NTP | Firewall → Internet |

### 23.6 Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string | Replit-managed in dev |
| `JWT_SECRET` | **Yes** | JWT signing secret (min 32 chars) | `change-me-in-production` |
| `PORT` | No | Web console listening port | `5000` |
| `NODE_ENV` | No | `development` or `production` | `development` |
| `FORCE_SETUP` | No | Set to `1` to re-run setup wizard | — |
| `SONARO_SKIP_SETUP` | No | Set to `1` to skip setup wizard | — |
| `POSTGRES_USER` | No | PostgreSQL username (Docker) | `sonaro` |
| `POSTGRES_PASSWORD` | No | PostgreSQL password (Docker) | (required in Docker) |
| `POSTGRES_DB` | No | PostgreSQL database name (Docker) | `sonaro` |

**Production `.env` template:**

```dotenv
DATABASE_URL=postgresql://sonaro:your-strong-password@localhost:5432/sonaro
JWT_SECRET=your-64-character-random-hex-string-here
NODE_ENV=production
PORT=5000
```

Generate a secure JWT secret:

```bash
openssl rand -hex 64
```

---

*Sonaro Gate 2025.1 LTS Handbook*  
*© 2026 Sonaro Gate Project — Open Source, MIT License*  
*Build: 2025.04 — Platform: Ubuntu 24.04 LTS x86\_64*
