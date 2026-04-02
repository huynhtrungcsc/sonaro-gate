# Deployment Guide — Sonaro Gate

This guide covers everything you need to deploy Sonaro Gate on Ubuntu 24.04 LTS, from a fresh server to a fully operational firewall. Read it from top to bottom — each step builds on the previous one.

---

## Table of Contents

1. [What you need before you start](#1-what-you-need-before-you-start)
2. [Understanding how Sonaro Gate works](#2-understanding-how-sonaro-gate-works)
3. [Install with one command](#3-install-with-one-command)
4. [What the installer does — step by step](#4-what-the-installer-does--step-by-step)
5. [After installation — configure network interfaces](#5-after-installation--configure-network-interfaces)
6. [First login and initial setup](#6-first-login-and-initial-setup)
7. [Managing the application](#7-managing-the-application)
8. [Updating Sonaro Gate](#8-updating-sonaro-gate)
9. [Reinstalling or wiping everything](#9-reinstalling-or-wiping-everything)
10. [Troubleshooting](#10-troubleshooting)
11. [Environment variables reference](#11-environment-variables-reference)

---

## 1. What you need before you start

### Hardware

| Component | Minimum | Recommended |
|---|---|---|
| OS | Ubuntu 24.04 LTS (64-bit) | Ubuntu 24.04 LTS |
| CPU | 2 cores | 4+ cores |
| RAM | 2 GB | 4–8 GB |
| Disk | 20 GB | 40+ GB SSD |
| **Network cards** | **2 NICs** (WAN + LAN) | 4 NICs (WAN + LAN + DMZ + Mgmt) |
| Privileges | `root` or `sudo` | — |

> **What is a NIC?** NIC stands for Network Interface Card — it's a physical network port (the slot you plug an Ethernet cable into). Your firewall machine needs at least two: one connected to your internet router (WAN side), and one connected to your internal network (LAN side). Without two NICs, traffic cannot pass through the firewall.

### Software

- A **fresh Ubuntu 24.04 LTS** installation (Desktop or Server edition both work)
- Internet access from the server (to download packages and the source code)
- A terminal with `root` or `sudo` access

### Checking your NICs

Before you begin, verify how many network interfaces your machine has:

```bash
ip link show
```

You should see at least two entries besides `lo` (loopback). Example output:

```
1: lo: <LOOPBACK> ...
2: eth0: <BROADCAST,MULTICAST,UP> ...       ← This will become WAN
3: eth1: <BROADCAST,MULTICAST,UP> ...       ← This will become LAN
```

> If you only see one NIC (`eth0`), you need to add a second network card before proceeding. On a VM, add a second network adapter in your hypervisor settings (VMware, VirtualBox, Proxmox, etc.).

---

## 2. Understanding how Sonaro Gate works

Sonaro Gate is a **web-based management console** that controls real Linux firewall tools. When you configure a rule in the web interface, it translates that into actual system commands that run on the Ubuntu server.

```
Internet ──► WAN (eth0) ──► [ Ubuntu 24.04 + Sonaro Gate ] ──► LAN (eth1) ──► Your devices
                                          │
                                   iptables   — controls which traffic is allowed
                                   netplan    — configures network interfaces  
                                   Suricata   — inspects traffic for threats (IPS)
                                   WireGuard  — manages VPN tunnels
                                   dnsmasq    — provides DHCP and DNS
```

> **Why Docker?** Sonaro Gate runs inside a Docker container. The container is configured with `--privileged` and `--network host`, which means commands run inside the container (like `iptables`, `ip route`, `sysctl`) affect the **real host machine**. Docker is used purely as a packaging mechanism — not for isolation.
>
> The advantage: you do not need to install Node.js, PostgreSQL, or any language runtime on the host. The container handles all of that. The host only needs Docker installed.

---

## 3. Install with one command

Paste this command into your server's terminal as `root` (or prefix with `sudo`):

```bash
curl -fsSL https://raw.githubusercontent.com/huynhtrungcsc/sonaro-gate/main/deploy/install.sh | sudo bash
```

> **What does this command do?**
> - `curl -fsSL ...` — downloads the installer script from GitHub (`-f` = fail on HTTP errors, `-s` = silent, `-S` = show errors, `-L` = follow redirects)
> - `|` — pipes the downloaded script directly to bash
> - `sudo bash` — runs it as root (required because it installs system packages and writes to `/opt`)

When run interactively (directly in a terminal), the script will ask you to choose between **Docker mode** (recommended) and **Native mode**. When run non-interactively (piped via curl), it defaults to Docker automatically.

### Force a specific mode without the prompt

```bash
# Docker mode (recommended — fastest, easiest)
curl -fsSL https://raw.githubusercontent.com/huynhtrungcsc/sonaro-gate/main/deploy/install.sh \
  | sudo INSTALL_METHOD=docker bash

# Native mode (installs Node.js + PostgreSQL directly on Ubuntu)
curl -fsSL https://raw.githubusercontent.com/huynhtrungcsc/sonaro-gate/main/deploy/install.sh \
  | sudo INSTALL_METHOD=native bash
```

### Docker vs Native — which to choose?

| | Docker mode | Native mode |
|---|---|---|
| Install time | ~3–5 minutes | ~5–10 minutes |
| What gets installed on host | Docker Engine only | Node.js + PostgreSQL + Suricata + tools |
| Update method | `git pull` + `docker compose up -d --build` | `git pull` + `npm run build` + `systemctl restart` |
| Data storage | Docker named volume (`pgdata`) | PostgreSQL on the host directly |
| Best for | Most users, VMs, homelab | Users who want direct access to processes |

**Recommendation**: use Docker mode unless you have a specific reason not to.

---

## 4. What the installer does — step by step

Understanding what the installer does helps you trust it and troubleshoot problems if they arise.

### Before installing — system check and clean wipe

At the very start, the installer runs a **system check** that shows you:

- Your OS version and whether it is fully supported
- Available CPU cores, RAM, and free disk space
- All network interfaces (so you can identify WAN and LAN)
- Internet connectivity (can it reach GitHub and Docker Hub)
- Which of the required tools are already installed

Then it checks for a **previous Sonaro Gate installation**:

- Existing Docker containers named `sonaro-gate` or `sonaro-db`
- An existing installation directory at `/opt/sonaro`
- An existing `sonaro-gate.service` systemd unit

If any of these are found, the installer will perform a **complete clean wipe** before proceeding. This includes:

1. Stopping and removing all containers and their Docker volumes (all data is erased)
2. Removing the Docker image (so a fresh build is done)
3. Stopping and disabling the systemd service
4. Deleting the installation directory

> **Why clean wipe instead of update?** When reinstalling, a partial or inconsistent state causes hard-to-debug problems. Starting from a known-clean state is always more reliable. If you just want to update (without losing your data), see [Section 8 — Updating](#8-updating-sonaro-gate).

---

### Docker mode — 5 steps

#### Step 1/5 — Install Docker Engine

If Docker is not already installed, the installer:

1. Adds Docker's official GPG key so Ubuntu can verify downloaded packages
2. Adds Docker's official apt repository
3. Installs `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-compose-plugin`
4. Enables Docker to start automatically on boot

> **Why not just `apt install docker.io`?** The `docker.io` package in Ubuntu's default repositories is often outdated. The official Docker repository always has the latest stable version with full `docker compose` support.

If Docker is already installed, this step is skipped automatically.

#### Step 2/5 — Download source code

The installer clones the repository into `/opt/sonaro`:

```bash
git clone --depth 1 https://github.com/huynhtrungcsc/sonaro-gate.git /opt/sonaro
```

> `--depth 1` means only the latest commit is downloaded, not the full history. This is faster and uses less disk space.

#### Step 3/5 — Write environment configuration

A `.env` file is created at `/opt/sonaro/.env` with:

| Variable | What it is |
|---|---|
| `POSTGRES_PASSWORD` | A random 40-character password for the database (auto-generated) |
| `JWT_SECRET` | A random 64-character secret for signing login session tokens (auto-generated) |
| `DATABASE_URL` | The full PostgreSQL connection string |
| `PORT` | The port Sonaro Gate listens on (default: 5000) |

The file is set to `chmod 600` so only root can read it.

> **Why does this matter?** The JWT secret is what makes your admin sessions secure. If someone obtains it, they can forge a login token. Keep the `.env` file private.

#### Step 4/5 — Build Docker image and start containers

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file .env build
docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d
```

The build step compiles the TypeScript source into a runnable application. This is the step that takes 3–5 minutes on first run. On subsequent runs (after updates), Docker's layer cache makes it much faster.

Two containers are started:

| Container | What it runs | Why |
|---|---|---|
| `sonaro-db` | PostgreSQL 16 | Stores all firewall rules, settings, logs |
| `sonaro-gate` | Sonaro Gate app | The web UI and backend API |

Both containers run with `--network host`, which means they use the host machine's network stack directly. This is required for `iptables` and `netplan` commands to affect real network traffic.

#### Step 5/5 — Health check

The installer polls `http://127.0.0.1:5000/api/health` every 5 seconds for up to 3 minutes. When the application responds, you know it is ready.

---

### Native mode — 7 steps

Native mode installs everything directly on Ubuntu without Docker.

#### Step 1/7 — System packages

Installs using `apt-get`:

| Package | Purpose |
|---|---|
| `iptables`, `iptables-persistent` | Linux firewall rules engine |
| `iproute2`, `ipset` | Network interface and IP set management |
| `netplan.io` | Network interface configuration |
| `postgresql`, `postgresql-client` | Database server |
| `suricata`, `suricata-update` | Intrusion detection/prevention engine |
| `wireguard`, `wireguard-tools` | VPN tunnel implementation |
| `dnsmasq` | DHCP and DNS server |
| `build-essential`, `git`, `curl`, `jq` | Build tools and utilities |

#### Step 2/7 — Node.js 20

Installed from NodeSource (the official Node.js maintainer's repository). Ubuntu's default `nodejs` package is too old. Node.js 20 is the LTS version required by Sonaro Gate.

> **Why Node.js 20 specifically?** Sonaro Gate uses TypeScript with modern async/await patterns that require Node.js 18 or later. Version 20 is the current Long Term Support (LTS) release — it receives security updates until April 2026.

#### Step 3/7 — Download and build source

Clones the repository, installs npm packages, and builds the React frontend with Vite.

#### Step 4/7 — Kernel settings

```bash
echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-sonaro.conf
sysctl -p /etc/sysctl.d/99-sonaro.conf
```

> **Why is IP forwarding required?** By default, Linux drops network packets that arrive on one interface and are destined for another. A router or firewall must forward these packets between interfaces (e.g., from WAN to LAN). `net.ipv4.ip_forward=1` enables this behaviour. Without it, your firewall will silently drop all traffic — no internet access for LAN devices.

Writing to `/etc/sysctl.d/99-sonaro.conf` makes this setting survive reboots.

#### Step 5/7 — PostgreSQL database

Creates the database user and database that Sonaro Gate uses to store its configuration.

#### Step 6/7 — Configuration and migrations

Writes `/opt/sonaro/.env` and runs Drizzle ORM schema migrations (creates all database tables), then seeds initial data (admin account, default settings).

#### Step 7/7 — Systemd service

Creates `/etc/systemd/system/sonaro-gate.service` and starts it. Systemd ensures:

- Sonaro Gate starts automatically when the server boots
- If the process crashes, systemd restarts it automatically after 5 seconds
- Logs are collected by `journald` (view with `journalctl -u sonaro-gate`)

---

## 5. After installation — configure network interfaces

> **This step is required.** Without assigning your NICs to WAN and LAN roles, Sonaro Gate cannot route traffic or apply firewall rules.

After the installer finishes, follow the [CLI Network Setup Guide](CLI-NETWORK-SETUP.md) to:

1. Assign which NIC is WAN (connected to your internet router)
2. Assign which NIC is LAN (connected to your internal network or switch)
3. Configure IP addresses for each interface
4. Enable NAT so LAN devices can reach the internet through the WAN

This is a one-time step that takes about 5 minutes.

---

## 6. First login and initial setup

From a device **on the LAN side** of the firewall, open a browser and go to:

```
http://<SERVER_LAN_IP>:5000
```

Replace `<SERVER_LAN_IP>` with the IP address of the LAN interface you configured in Step 5.

**Default credentials:**

| Field | Value |
|---|---|
| Email | `admin@sonaro.local` |
| Password | `Admin123!` |

### After first login — do these immediately

1. **Change the admin password**
   Go to **System → Administrators**, click the admin account, click **Edit**, and set a strong password.
   > If you skip this: anyone who accesses your web UI can log in with the default password and modify your firewall rules.

2. **Verify your firewall rules**
   Go to **Firewall → Policy & Objects → Firewall Rules** and review the default policy.

3. **Check the dashboard**
   The **Dashboard** shows real-time CPU, RAM, and network throughput. Verify that traffic is flowing through the expected interfaces.

4. **Set up admin account email**
   Go to **System → Settings** and update the hostname, timezone, and admin email.

---

## 7. Managing the application

### Docker mode

All commands are run from any directory (Docker Compose reads the compose file directly):

```bash
# View live application logs (Ctrl+C to stop)
docker compose -f /opt/sonaro/deploy/docker-compose.prod.yml logs -f sonaro-gate

# View PostgreSQL logs
docker compose -f /opt/sonaro/deploy/docker-compose.prod.yml logs -f db

# Restart the application (keeps data, reloads config)
docker compose -f /opt/sonaro/deploy/docker-compose.prod.yml restart sonaro-gate

# Stop everything
docker compose -f /opt/sonaro/deploy/docker-compose.prod.yml down

# Stop everything AND delete all data (irreversible)
docker compose -f /opt/sonaro/deploy/docker-compose.prod.yml down -v

# Open a shell inside the running container
docker exec -it sonaro-gate bash

# Check active iptables rules (from inside container = real host rules)
docker exec sonaro-gate iptables -L -v -n

# Check NAT rules
docker exec sonaro-gate iptables -t nat -L -v -n

# View Suricata IPS alerts in real time
docker exec sonaro-gate tail -f /var/log/suricata/fast.log
```

### Native mode

```bash
# Check service status
systemctl status sonaro-gate

# View live logs (Ctrl+C to stop)
journalctl -u sonaro-gate -f

# Restart after a config change
systemctl restart sonaro-gate

# Stop the service
systemctl stop sonaro-gate

# Start the service
systemctl start sonaro-gate

# Check if it starts on boot (should show 'enabled')
systemctl is-enabled sonaro-gate

# View active iptables rules
iptables -L -v -n

# View NAT rules
iptables -t nat -L -v -n

# View Suricata alerts
tail -f /var/log/suricata/fast.log
```

---

## 8. Updating Sonaro Gate

### Docker mode

```bash
cd /opt/sonaro

# Pull the latest source code
git pull

# Rebuild the image and restart (data is preserved in Docker volumes)
docker compose -f deploy/docker-compose.prod.yml up -d --build
```

> **Your data is safe.** The PostgreSQL data lives in a Docker named volume (`pgdata`). Rebuilding the image does not touch it. Only `docker compose down -v` deletes volumes.

### Native mode

```bash
cd /opt/sonaro

# Pull the latest source code
git pull

# Install any new npm dependencies
npm ci --omit=dev

# Rebuild the frontend
npm run build

# Apply any database schema changes
npx drizzle-kit push --force

# Restart the service
systemctl restart sonaro-gate
```

---

## 9. Reinstalling or wiping everything

If you need to start completely fresh (e.g., something went wrong, or you want to reset all settings):

Simply run the installer again:

```bash
curl -fsSL https://raw.githubusercontent.com/huynhtrungcsc/sonaro-gate/main/deploy/install.sh | sudo bash
```

The installer automatically detects the previous installation and performs a full clean wipe (containers, volumes, files, service) before reinstalling. It will ask you to confirm before deleting anything.

> **Warning**: the clean wipe erases all your firewall rules, VPN tunnels, user accounts, and settings. There is no undo. If you want to keep your data, take a backup first: **System → Backup & Restore → Export** in the web UI.

### Manual wipe (Docker mode)

If you want to wipe manually without reinstalling:

```bash
# Stop and delete containers + volumes (all data gone)
docker compose -f /opt/sonaro/deploy/docker-compose.prod.yml down -v

# Remove the image
docker rmi sonaro-gate:latest

# Remove the installation directory
rm -rf /opt/sonaro
```

### Manual wipe (Native mode)

```bash
# Stop and disable the service
systemctl stop sonaro-gate
systemctl disable sonaro-gate
rm -f /etc/systemd/system/sonaro-gate.service
systemctl daemon-reload

# Drop the database (all data gone)
sudo -u postgres psql -c "DROP DATABASE sonaro_gate;"
sudo -u postgres psql -c "DROP USER sonaro;"

# Remove files
rm -rf /opt/sonaro
rm -f /etc/sysctl.d/99-sonaro.conf
```

---

## 10. Troubleshooting

### Web UI is not accessible

**Check 1 — Is the service running?**

```bash
# Docker mode:
docker compose -f /opt/sonaro/deploy/docker-compose.prod.yml ps

# Native mode:
systemctl status sonaro-gate
```

**Check 2 — Is the port open?**

```bash
ss -tlnp | grep 5000
# Should show something like: LISTEN ... 0.0.0.0:5000
```

**Check 3 — Are you connecting from the right side?**

You must connect from the **LAN side** of the firewall. If you are connecting from the WAN side (internet), the management port is not exposed there by default.

**Check 4 — Firewall blocking port 5000?**

```bash
iptables -L INPUT -v -n | grep 5000
```

---

### Container fails to start

```bash
# View error logs from the application
docker compose -f /opt/sonaro/deploy/docker-compose.prod.yml logs sonaro-gate

# View error logs from the database
docker compose -f /opt/sonaro/deploy/docker-compose.prod.yml logs db
```

Common causes:

| Error | Likely cause | Fix |
|---|---|---|
| `password authentication failed` | Wrong `POSTGRES_PASSWORD` in `.env` | Edit `/opt/sonaro/.env` and run `docker compose up -d` |
| `port 5000 already in use` | Another process is on port 5000 | `lsof -i :5000` to find it, then stop it or change `PORT` in `.env` |
| `failed to read dockerfile` | Dockerfile not found | Make sure you cloned the full repo (not just the compose file) |
| Database not ready | PostgreSQL slow to start | Wait 30 seconds and try again — the health check retries |

---

### Native mode service won't start

```bash
# Show the last 50 log lines
journalctl -u sonaro-gate -n 50 --no-pager
```

Common causes:

- `DATABASE_URL` is wrong — open `/opt/sonaro/.env` and verify the password matches the PostgreSQL user
- PostgreSQL is not running — `systemctl start postgresql`
- Port conflict — `lsof -i :5000`

---

### Firewall rules are not working

```bash
# Check if IP forwarding is on (should print 1)
sysctl net.ipv4.ip_forward

# Enable it immediately (without reboot)
sysctl -w net.ipv4.ip_forward=1

# View all firewall rules
iptables -L -v -n

# View NAT rules
iptables -t nat -L -v -n
```

If IP forwarding was 0, your firewall is not forwarding any traffic. Enable it and traffic should flow immediately — no restart needed.

---

### Suricata IPS not running

```bash
# Check status
systemctl status suricata

# Test config file for errors
suricata -T -c /etc/suricata/suricata.yaml

# View suricata logs
journalctl -u suricata -n 30

# Update signatures manually
suricata-update
systemctl restart suricata
```

---

### Forgot the admin password

Connect to the database and reset it:

```bash
# Docker mode:
docker exec -it sonaro-db psql -U sonaro -d sonaro_gate -c \
  "UPDATE users SET password_hash = '\$2b\$10\$newhashedpassword' WHERE email = 'admin@sonaro.local';"

# Native mode:
sudo -u postgres psql -d sonaro_gate -c \
  "DELETE FROM users WHERE email = 'admin@sonaro.local';"
```

After deleting the admin user, restart the application — it will re-seed the default `admin@sonaro.local / Admin123!` credentials automatically on the next boot.

---

## 11. Environment variables reference

All variables are stored in `/opt/sonaro/.env`. Edit this file and restart the application to apply changes.

| Variable | Description | Default |
|---|---|---|
| `NODE_ENV` | Runtime environment | `production` |
| `PORT` | Web server port | `5000` |
| `DATABASE_URL` | PostgreSQL connection string | set by installer |
| `POSTGRES_DB` | Database name (Docker only) | `sonaro_gate` |
| `POSTGRES_USER` | Database user (Docker only) | `sonaro` |
| `POSTGRES_PASSWORD` | Database password (Docker only) | random 40 chars |
| `JWT_SECRET` | Session token signing secret | random 64 chars |
| `SONARO_SKIP_SETUP` | Set to `1` to skip CLI wizard | empty |

### Generate new secrets

```bash
# New database password (40 chars)
openssl rand -hex 20

# New JWT secret (64 chars)
openssl rand -hex 32
```

After changing the `JWT_SECRET`, all existing login sessions will be invalidated and users will need to log in again.
