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

# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /build

# Install dependencies first (layer cache)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source and build
COPY . .
RUN npm run build
# Result: /build/dist  (Vite static output served by Express in production)


# ── Stage 2: Production runtime ───────────────────────────────────────────────
FROM node:20-alpine AS production

# Install Linux networking tools required by the backend
RUN apk add --no-cache \
    iproute2 \
    iptables \
    iptables-legacy \
    ip6tables \
    ipset \
    curl \
    bash \
    && ln -sf /sbin/iptables-legacy /sbin/iptables \
    && ln -sf /sbin/ip6tables-legacy /sbin/ip6tables

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy server source (tsx transpiles at runtime)
COPY server/   ./server/
COPY shared/   ./shared/
COPY tsconfig.json tsconfig.node.json ./

# Copy built frontend
COPY --from=builder /build/dist ./dist

# Health check via the unauthenticated /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
    CMD wget -qO- http://localhost:${PORT:-5000}/api/health || exit 1

EXPOSE 5000

ENV NODE_ENV=production \
    PORT=5000

# Leave SONARO_SKIP_SETUP empty so the install.sh Docker mode (non-interactive)
# can pass SONARO_SKIP_SETUP=1 via docker-compose, while keeping the default
# behaviour of running the CLI wizard on bare-metal installs.
ENV SONARO_SKIP_SETUP=

CMD ["npx", "tsx", "server/index.ts"]
