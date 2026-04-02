#!/bin/bash
# ============================================
# Aegis NGFW - Production Deploy Script
# Ubuntu 24.04 LTS
# ============================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[AEGIS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Pre-checks ─────────────────────────────────
log "Checking prerequisites..."

command -v docker >/dev/null 2>&1 || err "Docker not found. Install with: sudo apt install docker.io docker-compose-plugin"
command -v docker compose >/dev/null 2>&1 || err "Docker Compose plugin not found."

if [ ! -f ".env.production" ]; then
  if [ -f "docker/.env.production.example" ]; then
    cp docker/.env.production.example .env.production
    warn "Created .env.production from template. EDIT IT before proceeding!"
    warn "  nano .env.production"
    exit 1
  else
    err ".env.production not found and no template available."
  fi
fi

source .env.production

# Validate critical vars
[ -z "${DOMAIN:-}" ] && err "DOMAIN not set in .env.production"
[ -z "${POSTGRES_PASSWORD:-}" ] && err "POSTGRES_PASSWORD not set"
[ -z "${JWT_SECRET:-}" ] && err "JWT_SECRET not set"
[ "${POSTGRES_PASSWORD}" = "CHANGE_ME_USE_STRONG_PASSWORD_HERE" ] && err "Change POSTGRES_PASSWORD from default!"
[ "${JWT_SECRET}" = "CHANGE_ME_GENERATE_WITH_openssl_rand_base64_48" ] && err "Change JWT_SECRET from default!"

log "Domain: ${DOMAIN}"
log "All pre-checks passed."

# ── Initial TLS Certificate ───────────────────
if [ ! -d "/etc/letsencrypt/live/${DOMAIN}" ] && [ ! -d "certbot-certs" ]; then
  log "Obtaining initial TLS certificate..."

  # Start nginx temporarily for ACME challenge
  docker compose -f docker-compose.production.yml --env-file .env.production up -d frontend

  sleep 3

  docker compose -f docker-compose.production.yml --env-file .env.production run --rm certbot \
    certbot certonly \
      --webroot \
      -w /var/www/certbot \
      -d "${DOMAIN}" \
      --email "${CERTBOT_EMAIL:-admin@${DOMAIN}}" \
      --agree-tos \
      --no-eff-email \
      --non-interactive

  docker compose -f docker-compose.production.yml --env-file .env.production down
  log "TLS certificate obtained!"
fi

# ── Deploy ─────────────────────────────────────
log "Building and starting production stack..."

docker compose -f docker-compose.production.yml --env-file .env.production build --no-cache
docker compose -f docker-compose.production.yml --env-file .env.production up -d

log "Waiting for services to start..."
sleep 10

# ── Health Check ───────────────────────────────
log "Running health checks..."

check_service() {
  local name=$1
  local container=$2
  if docker ps --filter "name=${container}" --filter "status=running" -q | grep -q .; then
    echo -e "  ${GREEN}✓${NC} ${name}"
  else
    echo -e "  ${RED}✗${NC} ${name} - NOT RUNNING"
  fi
}

check_service "Database"  "aegis-db"
check_service "API"       "aegis-api"
check_service "Frontend"  "aegis-frontend"
check_service "Certbot"   "aegis-certbot"
check_service "Backup"    "aegis-backup"

# Test HTTP->HTTPS redirect
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://${DOMAIN}/health" 2>/dev/null || echo "000")
HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://${DOMAIN}/health" 2>/dev/null || echo "000")

log "HTTP  status: ${HTTP_STATUS} (should be 301)"
log "HTTPS status: ${HTTPS_STATUS} (should be 200)"

echo ""
log "============================================"
log "  Aegis NGFW Production Deployment Complete"
log "  URL: https://${DOMAIN}"
log "  Default login: admin@aegis.local / Admin123!"
log "  CHANGE DEFAULT PASSWORD IMMEDIATELY!"
log "============================================"
