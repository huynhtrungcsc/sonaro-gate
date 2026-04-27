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

# Strip dev dependencies so the trimmed node_modules can be copied to production
# This avoids running `npm ci` (which requires network access) in the runtime stage.
RUN npm prune --omit=dev


# ── Stage 2: Ubuntu 24.04 LTS runtime ────────────────────────────────────────
# Ubuntu 24.04 is required for native netplan support.
# Alpine lacks `netplan` and has a different iptables stack, so Ubuntu is the
# correct base for a production firewall appliance.
FROM ubuntu:24.04 AS production

# Prevent interactive apt prompts
ENV DEBIAN_FRONTEND=noninteractive

# ── System packages ───────────────────────────────────────────────────────────
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
# libstdc++6        : C++ runtime needed by some native Node.js addons
# xz-utils          : needed to unpack Node.js official tarball
#
# Node.js is NOT installed from apt — Ubuntu 24.04 ships Node 18 which
# is incompatible with @noble/hashes@2.0.1 (requires >=20.19.0).
# We also cannot copy the node binary from the alpine builder stage because
# alpine uses musl libc while Ubuntu uses glibc — the binaries are
# incompatible and cause "/usr/bin/env: 'node': No such file or directory".
# Instead, download the official Node 20 LTS glibc tarball directly from
# nodejs.org during the Docker build step (network is available here).
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
    libstdc++6 \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*

# ── Node.js 20 LTS — official glibc binary (compatible with Ubuntu 24.04) ─────
# Pinned to 20.19.1 LTS. Update this line to upgrade Node.
ARG NODE_VERSION=20.19.1
RUN ARCH=$(dpkg --print-architecture | sed 's/amd64/x64/;s/arm64/arm64/') \
    && curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${ARCH}.tar.xz" \
       | tar -xJ -C /usr/local --strip-components=1 \
    && node --version \
    && npm --version

WORKDIR /app

# ── Production Node dependencies — pre-built and pruned in builder ────────────
# Copying from builder avoids running `npm ci` here (requires network access).
COPY --from=builder /build/node_modules ./node_modules
COPY package.json ./

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
