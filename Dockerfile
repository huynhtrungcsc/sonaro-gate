# ─────────────────────────────────────────────────────────────────────────────
# Sonaro Gate • 2025.1 LTS  —  Multi-stage Production Dockerfile
# Ubuntu 24.04 LTS compatible · Node.js 20 · PostgreSQL 16
#
# Build:   docker build -t sonaro-gate .
# Run:     docker run --privileged --network host sonaro-gate
#
# GitHub:  https://github.com/huynhtrungcsc/sonaro-gate
#
# NOTE: --privileged (or CAP_NET_ADMIN + CAP_NET_RAW) is required for
#       iptables, ip, sysctl, and netplan commands to function.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build frontend + generate DB migrations ─────────────────────────
FROM node:20-alpine AS builder

WORKDIR /build

# Install ALL dependencies (including devDeps: vite, drizzle-kit, tsx, etc.)
COPY package.json package-lock.json ./
# Configure npm retries and timeouts before installing — guards against
# transient ECONNRESET / network aborted errors on slow/unstable connections.
RUN npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-retries 5 \
    && npm config set maxsockets 5 \
    && npm ci --ignore-scripts

# Copy source
COPY . .

# Build the React frontend (output → /build/dist)
RUN npm run build

# Generate Drizzle SQL migration files from the schema.
# DATABASE_URL is not needed for `generate` — it only reads the TypeScript
# schema and emits SQL. A dummy URL satisfies the drizzle.config.ts validator.
RUN DATABASE_URL=postgresql://localhost/dummy npx drizzle-kit generate


# ── Stage 2: Production runtime ───────────────────────────────────────────────
FROM node:20-alpine AS production

# Install Linux networking tools required by the backend.
# On Alpine Linux the single `iptables` package ships both the nftables-backed
# binaries (/sbin/iptables, /sbin/ip6tables) AND the legacy xtables binaries
# (/sbin/iptables-legacy, /sbin/ip6tables-legacy).
# There is NO separate `iptables-legacy` or `ip6tables` Alpine package.
# We then point the default `iptables`/`ip6tables` commands to the legacy
# backend so the container works on hosts whose kernel lacks nftables support.
RUN apk add --no-cache \
    iproute2 \
    iptables \
    ipset \
    curl \
    bash \
    && ln -sf /sbin/iptables-legacy  /sbin/iptables  \
    && ln -sf /sbin/ip6tables-legacy /sbin/ip6tables

WORKDIR /app

# Install production dependencies only (no vite, no drizzle-kit, etc.)
COPY package.json package-lock.json ./
RUN npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-retries 5 \
    && npm config set maxsockets 5 \
    && npm ci --omit=dev --ignore-scripts

# Copy server source (tsx transpiles at runtime)
COPY server/   ./server/
COPY shared/   ./shared/
COPY tsconfig.json tsconfig.node.json ./

# Copy built frontend from builder
COPY --from=builder /build/dist ./dist

# Copy generated Drizzle migration files from builder.
# These are applied at container startup via server/migrate.ts → migrate()
# before seedDatabase() runs — ensuring all tables exist.
COPY --from=builder /build/drizzle ./drizzle

# Health check via the unauthenticated /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
    CMD wget -qO- http://localhost:${PORT:-5000}/api/health || exit 1

EXPOSE 5000

ENV NODE_ENV=production \
    PORT=5000

# Leave SONARO_SKIP_SETUP empty so the install.sh Docker mode (non-interactive)
# can pass SONARO_SKIP_SETUP=1 via docker-compose, while keeping the default
# behaviour of running the CLI wizard on bare-metal installs.
ENV SONARO_SKIP_SETUP=

CMD ["npx", "tsx", "server/index.ts"]
