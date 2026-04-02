# Deploy on Ubuntu 24.04 LTS

Deploy Sonaro Gate directly onto a bare-metal server or VM running Ubuntu 24.04 LTS. Recommended for production use — the application runs natively and has full access to `iptables`, `netplan`, and Suricata.

---

## Quick Deploy (One Command)

If your server can reach the internet, this installs and starts everything:

```bash
curl -fsSL https://raw.githubusercontent.com/huynhtrungcsc/sonaro-gate/main/deploy/install.sh | sudo bash
```

The script will ask you to choose between two modes:

```
  Choose install method:

  [1] Docker  (recommended)
      • Installs Docker Engine + starts containers
      • Faster setup — no need to install Node.js or PostgreSQL manually
      • Easy to update: git pull && docker compose up -d --build

  [2] Native
      • Installs Node.js 20 + PostgreSQL + Suricata directly on Ubuntu
      • Full direct kernel access (iptables, netplan, sysctl)
      • Runs as a systemd service: sonaro-gate.service

  Choice [1]:
```

To skip the prompt:

```bash
# Docker (recommended — fast)
curl -fsSL https://raw.githubusercontent.com/huynhtrungcsc/sonaro-gate/main/deploy/install.sh \
  | sudo INSTALL_METHOD=docker bash

# Native (bare-metal, full control)
curl -fsSL https://raw.githubusercontent.com/huynhtrungcsc/sonaro-gate/main/deploy/install.sh \
  | sudo INSTALL_METHOD=native bash
```

After this finishes (~3–10 minutes depending on method), proceed to **[CLI Network Setup](CLI-NETWORK-SETUP.md)** to configure your WAN/LAN/DMZ interfaces before first login.

---

## System Requirements

| Component | Minimum |
|---|---|
| OS | Ubuntu 24.04 LTS (Noble Numbat) — 64-bit |
| CPU | 2 cores |
| RAM | 2 GB |
| Disk | 20 GB |
| Network cards | **At least 2 NICs** — one WAN, one LAN |
| Privileges | `root` (required) |

---

## Step-by-Step Install

### 1 — Prepare the Machine

```bash
# Confirm Ubuntu 24.04
cat /etc/os-release | grep VERSION_ID
# Should print: VERSION_ID="24.04"

# List network interfaces
ip link show
# You need at least 2 (excluding lo): eth0, eth1 — or ens3, ens4, etc.

# Update package list
sudo apt-get update
```

### 2 — Download Sonaro Gate

```bash
sudo apt-get install -y git
git clone https://github.com/huynhtrungcsc/sonaro-gate.git /opt/sonaro-src
cd /opt/sonaro-src
```

### 3 — Run the Installer

```bash
sudo bash deploy/install.sh
```

The installer runs these steps in order:

| Step | What happens |
|---|---|
| 1 | `apt-get install` — iptables, iproute2, openssl, postgresql, netplan.io |
| 2 | Install Node.js 20.x from NodeSource |
| 3 | Install Suricata + download Emerging Threats rule sets |
| 4 | Install WireGuard + generate server key pair |
| 5 | Install OpenVPN + create PKI (CA, server cert, DH params) |
| 6 | Install dnsmasq (DHCP/DNS) |
| 7 | Enable IP forwarding in kernel |
| 8 | Create PostgreSQL database `sonaro_gate` and user |
| 9 | Copy files to `/opt/sonaro`, run `npm install` |
| 10 | Run Drizzle ORM migrations (create all tables) |
| 11 | Seed database (admin user, default settings) |
| 12 | Create `/etc/systemd/system/sonaro-gate.service` |
| 13 | `systemctl enable --now sonaro-gate` |

When complete, you will see:

```
╔══════════════════════════════════════════════════════════╗
║                   INSTALL COMPLETE                      ║
╚══════════════════════════════════════════════════════════╝

  Service: sonaro-gate (active/running)
  URL:     http://<LAN_IP>:5000
  Login:   admin@sonaro.local / Admin123!

  Next step: configure WAN/LAN interfaces
  Run:  sudo systemctl stop sonaro-gate
        sudo -E npx tsx /opt/sonaro/server/index.ts
```

### 4 — Configure Network Interfaces (CLI Wizard)

This is required before you can access the web UI from another device.

```bash
sudo systemctl stop sonaro-gate
sudo -E npx tsx /opt/sonaro/server/index.ts
```

The wizard will ask you to assign interfaces to WAN, LAN, and optionally DMZ, then configure IP addresses and NAT. See **[CLI Network Setup Guide](CLI-NETWORK-SETUP.md)** for the full walkthrough.

After the wizard finishes:

```bash
sudo systemctl start sonaro-gate
```

### 5 — Verify Everything Is Running

```bash
# Sonaro Gate application
sudo systemctl status sonaro-gate

# PostgreSQL database
sudo systemctl status postgresql

# Suricata IPS
sudo systemctl status suricata

# Check listening port
ss -tlnp | grep 5000
```

### 6 — First Login

From a device on the **LAN side** of the firewall, open a browser:

```
http://192.168.1.1:5000
```

Login:
- **Email**: `admin@sonaro.local`
- **Password**: `Admin123!`

**Change the password immediately** — System → Administrators → Edit.

---

## Manual Install (Step by Step)

If you want full control over each step, follow these commands instead of the installer script.

### Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # v20.x.x
```

### Install PostgreSQL

```bash
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql

# Create user and database
sudo -u postgres psql <<SQL
CREATE USER sonaro WITH PASSWORD 'change_this_strong_password';
CREATE DATABASE sonaro_gate OWNER sonaro;
\q
SQL
```

### Install Network Tools

```bash
sudo apt-get install -y \
  iptables iptables-persistent netfilter-persistent \
  iproute2 netplan.io openssl jq curl wget
```

### Install Suricata IPS

```bash
sudo apt-get install -y suricata suricata-update
sudo mkdir -p /etc/suricata/rules
sudo touch /etc/suricata/rules/sonaro-local.rules
sudo suricata-update               # Download ET/Open rule sets
sudo systemctl enable --now suricata
```

### Install WireGuard VPN

```bash
sudo apt-get install -y wireguard wireguard-tools
wg genkey | sudo tee /etc/wireguard/server_private.key | \
  wg pubkey  | sudo tee /etc/wireguard/server_public.key
sudo chmod 600 /etc/wireguard/server_private.key
```

### Enable IP Forwarding

```bash
sudo sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward=1"          | sudo tee /etc/sysctl.d/99-sonaro.conf
echo "net.ipv6.conf.all.forwarding=1" >> /etc/sysctl.d/99-sonaro.conf
sudo sysctl -p /etc/sysctl.d/99-sonaro.conf
```

### Deploy the Application

```bash
sudo cp -r /opt/sonaro-src /opt/sonaro
cd /opt/sonaro
sudo npm install
```

Create `/opt/sonaro/.env`:

```bash
sudo tee /opt/sonaro/.env > /dev/null <<ENV
DATABASE_URL=postgresql://sonaro:change_this_strong_password@localhost:5432/sonaro_gate
JWT_SECRET=$(openssl rand -hex 32)
NODE_ENV=production
PORT=5000
ADMIN_EMAIL=admin@sonaro.local
ADMIN_PASSWORD=Admin123!
ENV

sudo chmod 600 /opt/sonaro/.env
```

Run migrations and seed:

```bash
cd /opt/sonaro
sudo npm run db:push
sudo npx tsx server/seed.ts
```

Build frontend:

```bash
sudo npm run build
```

### Create systemd Service

```bash
sudo tee /etc/systemd/system/sonaro-gate.service > /dev/null <<SERVICE
[Unit]
Description=Sonaro Gate — Next-Generation Firewall Console
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/sonaro
EnvironmentFile=/opt/sonaro/.env
ExecStart=/usr/bin/node /opt/sonaro/dist/server/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=sonaro-gate

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable --now sonaro-gate
sudo systemctl status sonaro-gate
```

---

## Useful Commands

```bash
# View live application logs
sudo journalctl -u sonaro-gate -f

# View IPS alerts
sudo tail -f /var/log/suricata/fast.log

# See all active firewall rules
sudo iptables -L -v -n

# See active NAT rules
sudo iptables -t nat -L -v -n

# Restart after config changes
sudo systemctl restart sonaro-gate

# Reload Suricata rules (no restart)
sudo kill -USR2 $(pidof suricata)

# Test database connection
sudo -u postgres psql -d sonaro_gate -c "SELECT count(*) FROM firewall_rules;"
```

---

## Updating Sonaro Gate

```bash
# Pull latest code
cd /opt/sonaro-src
git pull

# Copy to install dir (excludes .env and node_modules)
sudo rsync -av --exclude='.env' --exclude='node_modules' . /opt/sonaro/

# Install any new packages
cd /opt/sonaro && sudo npm install

# Rebuild frontend
sudo npm run build

# Apply any schema changes
sudo npm run db:push

# Restart
sudo systemctl restart sonaro-gate
```

---

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | Yes (production) |
| `PORT` | Web server port | No (default: 5000) |
| `NODE_ENV` | `production` or `development` | No |
| `ADMIN_EMAIL` | Admin email for seed | No |
| `ADMIN_PASSWORD` | Admin password for seed | No |
| `SONARO_SKIP_SETUP` | Set to `1` to skip CLI wizard | No |

Generate a secure JWT_SECRET:

```bash
openssl rand -hex 32
```

---

## Troubleshooting

### Service won't start

```bash
sudo journalctl -u sonaro-gate -n 50 --no-pager
```

Common causes:
- `DATABASE_URL` wrong — check `/opt/sonaro/.env`
- PostgreSQL not running — `sudo systemctl start postgresql`
- Port 5000 already in use — `sudo lsof -i :5000`

### Can't reach web UI

- Is the service running? `sudo systemctl status sonaro-gate`
- Is the LAN IP correct? `ip addr show eth1`
- Is there a firewall blocking port 5000? `sudo iptables -L INPUT -v -n`
- Are you connecting from the LAN side (not WAN)?

### Firewall rules not applying

- Must run as root — check with `whoami` (should print `root`)
- Check: `sudo iptables -L -n -v`
- View server logs: `sudo journalctl -u sonaro-gate -f`

### Suricata not starting

```bash
sudo journalctl -u suricata -n 50
sudo suricata -T -c /etc/suricata/suricata.yaml   # test config
```
