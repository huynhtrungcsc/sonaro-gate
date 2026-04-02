# Sonaro Gate • 2025.1 LTS

**Next-Generation Firewall Management Console** — Self-hosted on Ubuntu 24.04 LTS.

```
Internet ──► WAN (eth0) ──► [ SONARO GATE ] ──► LAN (eth1) ──► Your Network
                                    │
                             iptables + NAT
                             Suricata IPS
                             WireGuard VPN
                             Web Console :5000
```

Sonaro Gate turns any Ubuntu 24.04 LTS server (or bare-metal PC with two network cards) into a fully functional firewall appliance. Every rule you configure in the web UI is applied directly to the Linux kernel — no simulation, no demo data.

---

## Quick Deploy (One Command)

```bash
curl -fsSL https://raw.githubusercontent.com/huynhtrungcsc/sonaro-gate/main/deploy/install.sh | sudo bash
```

After install, run the CLI network wizard to configure your WAN/LAN interfaces before opening the web UI. See → **[CLI Network Setup Guide](docs/CLI-NETWORK-SETUP.md)**

---

## Features

| Capability | Linux Tool | Status |
|---|---|---|
| Firewall rules (allow / deny / reject) | `iptables` | ✅ |
| NAT / Internet sharing | `iptables -t nat MASQUERADE` | ✅ |
| Port forwarding (DNAT) | `iptables -t nat PREROUTING` | ✅ |
| IP forwarding (router mode) | `sysctl net.ipv4.ip_forward` | ✅ |
| WAN/LAN interface configuration | `ip`, `netplan` | ✅ |
| Config persistence across reboots | `netplan` + `iptables-persistent` | ✅ |
| IDS/IPS engine | `suricata` + `suricata-update` | ✅ |
| Virtual IPs (IP aliases) | `ip addr label` | ✅ |
| Static routes | `ip route` | ✅ |
| WireGuard VPN | `wireguard-tools` | ✅ |
| DHCP/DNS server | `dnsmasq` | ✅ |
| Real-time dashboard (CPU/RAM/NIC) | `/proc` + `/sys/class/net` | ✅ |
| Live metrics via WebSocket | Node.js WS | ✅ |
| Audit log | PostgreSQL | ✅ |
| Backup & restore (JSON export) | Built-in | ✅ |

---

## System Requirements

| Component | Minimum | Recommended |
|---|---|---|
| OS | Ubuntu 24.04 LTS (64-bit) | Ubuntu 24.04 LTS |
| CPU | 2 cores | 4+ cores |
| RAM | 2 GB | 4–8 GB |
| Disk | 20 GB | 40+ GB SSD |
| **Network cards** | **2 NICs** (WAN + LAN) | 4 NICs (WAN + LAN + DMZ + Mgmt) |
| Privileges | `root` (required for iptables/netplan) | — |

> A NIC (Network Interface Card) is a physical network port. Your firewall machine needs at least two: one facing the internet (WAN) and one facing your internal network (LAN).

---

## Deployment Guides

| Guide | Description |
|---|---|
| [Ubuntu Bare-Metal / VM](docs/DEPLOY-UBUNTU.md) | Full step-by-step install on Ubuntu 24.04 LTS |
| [Docker / Docker Compose](docs/DEPLOY-DOCKER.md) | Container-based deployment |
| **[CLI Network Setup ← START HERE](docs/CLI-NETWORK-SETUP.md)** | Configure WAN/LAN/DMZ interfaces before first login |

---

## Default Login

| Field | Value |
|---|---|
| URL | `http://<LAN_IP>:5000` |
| Email | `admin@sonaro.local` |
| Password | `Admin123!` |

> **Change the password immediately after first login** — System → Administrators → Edit.

---

## Project Structure

```
sonaro-gate/
├── src/           React frontend (TypeScript, 43 pages)
├── server/        Express backend + iptables/netplan/suricata integration
├── shared/        Drizzle ORM schema (source of truth for DB + types)
├── scripts/       setup-ubuntu.sh, deploy scripts, systemd service
├── deploy/        One-command installer (install.sh)
├── docker/        Nginx configs, PostgreSQL hardening, init.sql
├── docs/          Architecture, deployment guides, handbook
└── public/        Static assets (favicon, robots.txt)
```

---

## Documentation

- [Ubuntu Deploy Guide](docs/DEPLOY-UBUNTU.md)
- [Docker Deploy Guide](docs/DEPLOY-DOCKER.md)
- [CLI Network Setup (WAN/LAN/DMZ)](docs/CLI-NETWORK-SETUP.md)
- [System Architecture](docs/ARCHITECTURE.md)
- [Admin Handbook](docs/HANDBOOK.md)

---

## License

[MIT](LICENSE) — Sonaro Gate • 2025.1 LTS
