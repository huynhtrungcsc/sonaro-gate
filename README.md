<div align="center">

<h1>Sonaro Gate</h1>

<p><strong>Next-Generation Firewall Management Console</strong><br>
Self-hosted on Ubuntu 24.04 LTS</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2025.1%20LTS-blue.svg)](https://github.com/huynhtrungcsc/sonaro-gate/releases)
[![Platform](https://img.shields.io/badge/platform-Ubuntu%2024.04%20LTS-orange.svg)](https://ubuntu.com/)
[![Stack](https://img.shields.io/badge/stack-TypeScript%20%7C%20React%20%7C%20Express%20%7C%20PostgreSQL-informational.svg)](https://github.com/huynhtrungcsc/sonaro-gate)

</div>

---

Sonaro Gate transforms any Ubuntu 24.04 LTS server or bare-metal machine with two NICs into a production-grade firewall appliance — managed entirely through a modern web UI. Every rule configured in the console maps directly to Linux kernel primitives (`iptables`, `netplan`, `Suricata`, `WireGuard`). No simulation. No vendor lock-in.

```
Internet ──► WAN (eth0) ──► [ SONARO GATE ] ──► LAN (eth1) ──► Internal Network
                                     │
                              iptables / nftables
                              Suricata IPS/IDS
                              WireGuard VPN
                              Web Console :5000
```

## Features

| Capability | Engine | Status |
|---|---|---|
| Stateful firewall rules (allow / deny / reject) | `iptables` | ✅ |
| NAT and internet sharing | `iptables -t nat MASQUERADE` | ✅ |
| Port forwarding (DNAT) | `iptables -t nat PREROUTING` | ✅ |
| WAN / LAN / DMZ interface management | `ip`, `netplan` | ✅ |
| Static and dynamic routing (BGP, OSPF, RIP) | Built-in | ✅ |
| Virtual IPs and IP pools | `ip addr` | ✅ |
| IPsec and WireGuard VPN tunnels | `wireguard-tools` | ✅ |
| DHCP server and DNS forwarding | `dnsmasq` | ✅ |
| DNS filtering and local records | Built-in | ✅ |
| IDS / IPS with signature management | `suricata` | ✅ |
| Traffic shaping and QoS policies | `tc` | ✅ |
| Real-time dashboard (CPU / RAM / NIC metrics) | `/proc`, `/sys/class/net` | ✅ |
| Live telemetry via WebSocket | Node.js WS | ✅ |
| Audit log and system event viewer | PostgreSQL | ✅ |
| Local user and group management | Built-in | ✅ |
| LDAP / RADIUS authentication | Built-in | ✅ |
| Reports and traffic analytics | Built-in | ✅ |
| Backup and restore (JSON export) | Built-in | ✅ |
| High availability (Active-Passive / Active-Active) | Built-in | ✅ |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query |
| Backend | Node.js, Express, TypeScript, Drizzle ORM |
| Database | PostgreSQL |
| Real-time | WebSocket (ws) |
| Network engine | iptables, netplan, Suricata, WireGuard, dnsmasq |
| Auth | bcrypt, JWT session |
| Deployment | Docker / Docker Compose, systemd, native Ubuntu |

## Requirements

| Component | Minimum | Recommended |
|---|---|---|
| OS | Ubuntu 24.04 LTS (64-bit) | Ubuntu 24.04 LTS |
| CPU | 2 cores | 4+ cores |
| RAM | 2 GB | 4–8 GB |
| Disk | 20 GB | 40+ GB SSD |
| Network cards | 2 NICs (WAN + LAN) | 4 NICs (WAN + LAN + DMZ + Mgmt) |
| Privileges | `root` required for iptables / netplan | — |

## Quick Start

```bash
curl -fsSL https://raw.githubusercontent.com/huynhtrungcsc/sonaro-gate/main/deploy/install.sh | sudo bash
```

The installer prompts for deployment method:

| Option | Description |
|---|---|
| **Docker** (default) | Installs Docker Engine, builds image, starts containers |
| **Native** | Installs Node.js 20 + PostgreSQL + Suricata directly as a systemd service |

After installation, run the CLI network wizard to configure WAN/LAN/DMZ interfaces before accessing the web console. See [CLI Network Setup Guide](docs/CLI-NETWORK-SETUP.md).

**Default credentials:**

| Field | Value |
|---|---|
| URL | `http://<LAN_IP>:5000` |
| Email | `admin@sonaro.local` |
| Password | `Admin123!` |

> Change the default password immediately after first login — **System → Administrators → Edit**.

## Repository Layout

```
sonaro-gate/
├── client/        React frontend (TypeScript, 40+ pages)
├── server/        Express backend + Linux kernel integration
├── shared/        Drizzle ORM schema (single source of truth for DB + types)
├── deploy/        install.sh, docker-compose.prod.yml, nginx, systemd unit
├── scripts/       setup-ubuntu.sh, backup.sh, sonaro-agent
├── docker/        init.sql, postgresql-hardened.conf
├── docs/          Architecture reference, deployment guides, admin handbook
└── public/        Static assets
```

## Documentation

- [Ubuntu Deploy Guide](docs/DEPLOY-UBUNTU.md)
- [Docker Deploy Guide](docs/DEPLOY-DOCKER.md)
- [CLI Network Setup](docs/CLI-NETWORK-SETUP.md)
- [System Architecture](docs/ARCHITECTURE.md)
- [Admin Handbook](docs/HANDBOOK.md)

## Contributing

Contributions are welcome. Please open an issue to discuss what you would like to change before submitting a pull request. For large changes, describe the problem, proposed solution, and any trade-offs.

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Commit following [Conventional Commits](https://www.conventionalcommits.org/)
4. Open a pull request against `main`

## License

[MIT](LICENSE) © 2025 Huỳnh Chí Trung
