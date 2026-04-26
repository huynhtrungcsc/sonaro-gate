# ─────────────────────────────────────────────────────────────────────────────
# Sonaro Gate • 2025.1 LTS  —  Multi-stage Production Dockerfile
# Builder: node:20-alpine  (fast asset build + drizzle-kit generate)
# Runtime: ubuntu:24.04    (full netplan / iptables / dhclient support)
#
# Build:   docker build -t sonaro-gate .
# Run:     docker compose up -d          (see docker-compose.yml)
#          -- or --
#          docker run --privileged --network host \
#            -e DATABASE_URL=... -e JWT_SECRET=... sonaro-gate
#
# Root required for: iptables, ip addr, sysctl, netplan apply, dhclient.
# The container runs as root by default so all OS commands work immediately.
#
# GitHub:  https://github.com/huynhtrungcsc/sonaro-gate
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build frontend + generate Drizzle migrations ────────────────────
FROM node:20-alpine AS builder

WORKDIR /build

# Resilient npm install — guards against transient network errors
COPY package.json package-lock.json ./
RUN npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-retries 5 \
    && npm config set maxsockets 5 \
    && npm ci --ignore-scripts

COPY . .

# Build React SPA → /build/dist
RUN npm run build

# Generate Drizzle SQL migration files from schema (no live DB needed)
RUN DATABASE_URL=postgresql://localhost/dummy npx drizzle-kit generate


# ── Stage 2: Ubuntu 24.04 LTS runtime ────────────────────────────────────────
# Ubuntu 24.04 is required for native netplan support.
# Alpine lacks `netplan` and has a different iptables stack, so Ubuntu is the
# correct base for a production firewall appliance.
FROM ubuntu:24.04 AS production

# Prevent interactive apt prompts
ENV DEBIAN_FRONTEND=noninteractive

# ── System packages + Node.js ─────────────────────────────────────────────────
# iproute2          : ip addr, ip route, ip link  (also used by agent.ts)
# iptables          : iptables / ip6tables  (nftables-backed + legacy)
# ipset             : ipset for dynamic address sets
# netplan.io        : netplan generate / netplan apply  (Ubuntu-native)
# isc-dhcp-client   : dhclient — DHCP client for WAN interfaces
# dhcpcd            : lightweight DHCP client (fallback)
# net-tools         : ifconfig, netstat (legacy tools some scripts expect)
# curl wget         : health check + external connectivity tests
# procps            : pgrep / ps — used to detect running dhclient processes
# ca-certificates   : TLS bundle for outbound HTTPS calls
# nodejs npm        : Node.js runtime — Ubuntu 24.04 ships Node 18 LTS which
#                     satisfies tsx ≥ 18 requirement; avoids external curl deps
#
# NOTE: Do NOT use NodeSource (nodesource.com/setup_20.x) here. That script
# requires an outbound curl during the Docker build layer which fails on
# air-gapped or rate-limited hosts. The Ubuntu 24.04 built-in Node.js package
# is sufficient and requires no external network beyond apt mirrors.
RUN apt-get update -qq && apt-get install -y --no-install-recommends \
    iproute2 \
    iptables \
    ipset \
    netplan.io \
    isc-dhcp-client \
    dhcpcd \
    net-tools \
    curl \
    wget \
    procps \
    ca-certificates \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Production Node dependencies ──────────────────────────────────────────────
COPY package.json package-lock.json ./
RUN npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-retries 5 \
    && npm config set maxsockets 5 \
    && npm ci --omit=dev --ignore-scripts

# ── Application source (server, shared) ───────────────────────────────────────
COPY server/   ./server/
COPY shared/   ./shared/
COPY tsconfig.json tsconfig.node.json ./

# ── Compiled frontend from builder ────────────────────────────────────────────
COPY --from=builder /build/dist ./dist

# ── Drizzle migration files from builder ──────────────────────────────────────
# Applied at container startup via server/migrate.ts before seedDatabase()
COPY --from=builder /build/drizzle ./drizzle

# ── Health check ──────────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
    CMD wget -qO- http://localhost:${PORT:-5000}/api/health || exit 1

EXPOSE 5000

ENV NODE_ENV=production \
    PORT=5000

# Leave blank so docker-compose / install.sh can set SONARO_SKIP_SETUP=1
# while bare-metal boots run the interactive CLI wizard by default.
ENV SONARO_SKIP_SETUP=

# Run as root — required for iptables, ip addr, sysctl, netplan, dhclient
CMD ["npx", "tsx", "server/index.ts"]
