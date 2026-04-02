# Deploy with Docker

Run Sonaro Gate in a Docker container. Because `iptables` and `netplan` must control the **host machine's kernel**, the container requires `--privileged` and `--network host` modes.

> **For real firewall enforcement**: Docker must run on an Ubuntu 24.04 host. With `--network host`, iptables rules applied inside the container go directly to the host kernel — the firewall is real.

---

## Quick Start (Docker Compose)

```bash
# 1. Clone the repo
git clone https://github.com/huynhtrungcsc/sonaro-gate.git
cd sonaro-gate

# 2. Set your passwords
cp .env.example .env
nano .env

# 3. Start everything (PostgreSQL + Sonaro Gate)
docker compose up -d

# 4. Watch the logs
docker compose logs -f sonaro-gate
```

Web UI: **http://localhost:5000** (or `http://<host-LAN-IP>:5000` from another machine)

Login: `admin@sonaro.local` / `Admin123!`

After first login, configure network interfaces via **Interfaces** in the web UI, or via the CLI — see [CLI Network Setup Guide](CLI-NETWORK-SETUP.md).

---

## Environment File

Copy and edit before starting:

```bash
cp .env.example .env
```

Minimum settings to change in `.env`:

```env
# Database password
POSTGRES_PASSWORD=choose_a_strong_password

# MUST change in production — generate with: openssl rand -hex 32
JWT_SECRET=replace_with_64_char_random_string

# Admin credentials for first login
ADMIN_EMAIL=admin@sonaro.local
ADMIN_PASSWORD=Admin123!
```

Generate a secure JWT_SECRET:

```bash
openssl rand -hex 32
```

---

## Production Docker Compose

For production use with full iptables/NAT enforcement on the host:

```bash
docker compose -f docker-compose.production.yml up -d
```

The production compose file uses `network_mode: host` and `privileged: true`, which means iptables rules apply to the real host kernel. It also includes Nginx as a reverse proxy on port 443 (HTTPS).

---

## Docker Run (without Compose)

```bash
# Build the image
docker build -t sonaro-gate:latest .

# Start PostgreSQL
docker run -d \
  --name sonaro-db \
  -e POSTGRES_DB=sonaro_gate \
  -e POSTGRES_USER=sonaro \
  -e POSTGRES_PASSWORD=changeme \
  -v pgdata:/var/lib/postgresql/data \
  postgres:16-alpine

# Start Sonaro Gate
docker run -d \
  --name sonaro-gate \
  --privileged \
  --network host \
  -e DATABASE_URL=postgresql://sonaro:changeme@localhost:5432/sonaro_gate \
  -e JWT_SECRET=$(openssl rand -hex 32) \
  -e NODE_ENV=production \
  -e PORT=5000 \
  -v /etc/netplan:/etc/netplan \
  -v /etc/iptables:/etc/iptables \
  -v /etc/suricata:/etc/suricata \
  -v /var/log/suricata:/var/log/suricata \
  sonaro-gate:latest
```

> With `--network host`, the container shares the host's network stack. Port 5000 is accessible on the host directly — no `-p` flag needed.

---

## Useful Docker Commands

```bash
# View live logs
docker compose logs -f sonaro-gate

# Restart the app
docker compose restart sonaro-gate

# Stop everything
docker compose down

# Stop and delete all data (careful!)
docker compose down -v

# Open a shell inside the container
docker compose exec sonaro-gate bash

# View active iptables rules (from inside container = real host rules)
docker compose exec sonaro-gate iptables -L -v -n

# View Suricata IPS alerts
docker compose exec sonaro-gate tail -f /var/log/suricata/fast.log
```

---

## Updating

```bash
# Pull latest image
docker compose pull

# Restart with new image
docker compose up -d

# Or rebuild from source
docker compose build --no-cache
docker compose up -d
```

---

## Volumes

| Volume | Purpose |
|---|---|
| `pgdata` | PostgreSQL data (all firewall config) |
| `/etc/netplan` (bind mount) | Write network config that persists on the host |
| `/etc/iptables` (bind mount) | iptables-persistent rule files |
| `/etc/suricata` (bind mount) | Suricata config + custom rules |
| `/var/log/suricata` (bind mount) | IPS alert logs |

---

## Notes on Privileges

| Mode | What works |
|---|---|
| `--privileged --network host` | Full iptables/NAT on real host, Suricata IPS, netplan — **production** |
| `--cap-add NET_ADMIN,NET_RAW` | iptables works, but network isolation applies — dev/test only |
| No special flags | Web UI + database works, iptables commands fail silently — dev only |

For true firewall functionality, use `--privileged --network host` on an Ubuntu 24.04 bare-metal host or VM.
