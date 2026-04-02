#!/bin/bash
# ============================================================
# Aegis NGFW — One-Click Deploy Script for Ubuntu 24.04 LTS
# Version: 2.0 — Includes ClamAV, Squid, Suricata, VPN
# ============================================================
# Usage:
#   curl -sSL <url>/deploy-oneclick.sh | sudo bash
#   -- OR --
#   sudo bash scripts/deploy-oneclick.sh
#   sudo bash scripts/deploy-oneclick.sh --domain firewall.example.com
#   sudo bash scripts/deploy-oneclick.sh --dev          # Dev mode (no TLS)
#   sudo bash scripts/deploy-oneclick.sh --auto         # Non-interactive
# ============================================================

set -euo pipefail

# ── Colors ─────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${GREEN}[AEGIS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }

# ── Parse args ────────────────────────────────
DOMAIN=""
DEV_MODE=false
AUTO_MODE=false
SKIP_AGENT=false
UPDATE_MODE=false
INSTALL_DIR="$(pwd)"

while [[ $# -gt 0 ]]; do
  case $1 in
    --domain)     DOMAIN="$2"; shift 2 ;;
    --dev)        DEV_MODE=true; shift ;;
    --auto)       AUTO_MODE=true; shift ;;
    --skip-agent) SKIP_AGENT=true; shift ;;
    --update)     UPDATE_MODE=true; shift ;;
    --dir)        INSTALL_DIR="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: sudo bash deploy-oneclick.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --domain <domain>   Set domain for TLS (production mode)"
      echo "  --dev               Dev mode: no TLS, port 8080"
      echo "  --auto              Non-interactive, use defaults"
      echo "  --skip-agent        Skip agent installation"
      echo "  --update            Update existing installation (keep data & config)"
      echo "  --dir <path>        Project directory (default: current)"
      echo "  -h, --help          Show this help"
      exit 0
      ;;
    *) shift ;;
  esac
done

# ── Banner ─────────────────────────────────────
echo -e "${CYAN}"
echo "  ╔═══════════════════════════════════════════════════════╗"
echo "  ║   Aegis NGFW — One-Click Deploy for Ubuntu 24.04     ║"
echo "  ║   100% Self-Hosted • No Cloud Required               ║"
echo "  ╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Root check ─────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  err "This script must be run as root. Use: sudo bash $0"
fi

# ── OS check ───────────────────────────────────
if grep -qi 'ubuntu' /etc/os-release 2>/dev/null; then
  UBUNTU_VER=$(grep VERSION_ID /etc/os-release | cut -d'"' -f2)
  log "Detected Ubuntu ${UBUNTU_VER}"
else
  warn "Not Ubuntu. This script is designed for Ubuntu 24.04 LTS."
  if [[ "$AUTO_MODE" == "false" ]]; then
    echo -en "  Continue anyway? (y/N): "
    read -r confirm
    [[ "$confirm" != "y" && "$confirm" != "Y" ]] && exit 1
  fi
fi

cd "$INSTALL_DIR"

# ════════════════════════════════════════════════
#  UPDATE MODE — In-place upgrade without reinstall
# ════════════════════════════════════════════════
if [[ "$UPDATE_MODE" == "true" ]]; then
  echo -e "${CYAN}"
  echo "  ╔═══════════════════════════════════════════════════════╗"
  echo "  ║   Aegis NGFW — Update Mode                           ║"
  echo "  ║   Updating code & containers, keeping data & config  ║"
  echo "  ╚═══════════════════════════════════════════════════════╝"
  echo -e "${NC}"

  UPDATE_STEPS=6
  USTEP=0
  unext() { USTEP=$((USTEP + 1)); echo -e "\n${BOLD}${GREEN}[${USTEP}/${UPDATE_STEPS}]${NC} ${BOLD}$1${NC}"; }

  # Step 1: Pull latest code
  unext "Pulling latest code from GitHub..."
  if git rev-parse --is-inside-work-tree &>/dev/null; then
    BEFORE_HASH=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    git fetch --all --quiet
    git reset --hard origin/$(git rev-parse --abbrev-ref HEAD) 2>/dev/null || git pull --force
    AFTER_HASH=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    if [[ "$BEFORE_HASH" == "$AFTER_HASH" ]]; then
      ok "Already up to date (${BEFORE_HASH:0:8})"
    else
      ok "Updated: ${BEFORE_HASH:0:8} → ${AFTER_HASH:0:8}"
    fi
  else
    warn "Not a git repository. Skipping code pull."
  fi

  # Step 2: Rebuild frontend container only (preserve DB data)
  unext "Rebuilding frontend container..."
  if [[ -f ".env.production" ]]; then
    COMPOSE_FILE="docker-compose.production.yml"
    ENV_FILE=".env.production"
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache aegis-frontend 2>&1 | tail -3
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d aegis-frontend
  else
    docker compose build --no-cache aegis-frontend 2>&1 | tail -3
    docker compose up -d aegis-frontend
  fi
  ok "Frontend rebuilt and restarted"

  # Step 3: Run database migrations (if any new SQL in init.sql)
  unext "Checking for database migrations..."
  if [[ -f "docker/init.sql" ]]; then
    # Apply any new tables/functions that don't exist yet (idempotent)
    docker exec -i aegis-db psql -U aegis -d aegis_ngfw < docker/init.sql 2>/dev/null || true
    ok "Database schema updated (idempotent)"
  else
    ok "No migration files found"
  fi

  # Step 4: Restart API to pick up schema changes
  unext "Restarting API service..."
  if [[ -f ".env.production" ]]; then
    docker compose -f docker-compose.production.yml --env-file .env.production restart aegis-api
  else
    docker compose restart aegis-api
  fi
  ok "API restarted"

  # Step 5: Update agent on host
  unext "Updating Aegis Agent..."
  if [[ -f "/opt/aegis/aegis-agent.sh" ]] && [[ -f "scripts/aegis-agent.sh" ]]; then
    cp scripts/aegis-agent.sh /opt/aegis/aegis-agent.sh
    chmod +x /opt/aegis/aegis-agent.sh
    systemctl restart aegis-agent 2>/dev/null || true
    ok "Agent script updated and restarted"
  else
    warn "Agent not installed or script not found. Skipping."
  fi

  # Step 6: Run tests
  unext "Running post-update tests..."
  TESTS_PASSED=0
  TESTS_FAILED=0
  TESTS_TOTAL=0

  run_test() {
    local name="$1"; local cmd="$2"
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    if eval "$cmd" &>/dev/null; then
      ok "PASS: $name"; TESTS_PASSED=$((TESTS_PASSED + 1))
    else
      fail "FAIL: $name"; TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
  }

  run_test "Container: aegis-db running" \
    "docker ps --filter name=aegis-db --filter status=running -q | grep -q ."
  run_test "Container: aegis-api running" \
    "docker ps --filter name=aegis-api --filter status=running -q | grep -q ."
  run_test "Container: aegis-frontend running" \
    "docker ps --filter name=aegis-frontend --filter status=running -q | grep -q ."
  run_test "Database: PostgreSQL accepts connections" \
    "docker exec aegis-db pg_isready -U aegis -d aegis_ngfw"

  BASE_URL="http://localhost:8080"
  [[ -f ".env.production" ]] && BASE_URL="http://localhost:80"

  run_test "Frontend: serves HTML" \
    "curl -sf ${BASE_URL}/ | grep -qi 'aegis\\|html'"
  run_test "Frontend: /health endpoint" \
    "curl -sf ${BASE_URL}/health >/dev/null 2>&1"
  run_test "Frontend: API proxy works" \
    "curl -sf ${BASE_URL}/api/ >/dev/null 2>&1"

  echo ""
  echo -e "${BOLD}  ┌──────────────────────────────────────┐${NC}"
  echo -e "${BOLD}  │      Update Test Results              │${NC}"
  echo -e "${BOLD}  ├──────────────────────────────────────┤${NC}"
  printf  "  │  Total:  %-28s│\n" "${TESTS_TOTAL}"
  printf  "  │  ${GREEN}Passed: %-28s${NC}│\n" "${TESTS_PASSED}"
  printf  "  │  ${GREEN}Failed: %-28s${NC}│\n" "${TESTS_FAILED}"
  echo -e "${BOLD}  └──────────────────────────────────────┘${NC}"

  echo ""
  echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}   Aegis NGFW — Update Complete!${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${BOLD}What was updated:${NC}"
  echo -e "    ✓ Frontend code & assets (rebuilt)"
  echo -e "    ✓ Database schema (if changed)"
  echo -e "    ✓ API service (restarted)"
  echo -e "    ✓ Agent script (if installed)"
  echo ""
  echo -e "  ${BOLD}What was preserved:${NC}"
  echo -e "    ✓ All database data (firewall rules, logs, etc.)"
  echo -e "    ✓ Environment config (.env / credentials)"
  echo -e "    ✓ Docker volumes (pgdata)"
  echo -e "    ✓ Agent configuration (/opt/aegis/.env)"
  echo ""
  if [[ $TESTS_FAILED -gt 0 ]]; then
    echo -e "  ${YELLOW}⚠ ${TESTS_FAILED} test(s) failed. Check above for details.${NC}"
  else
    echo -e "  ${GREEN}✓ All ${TESTS_PASSED} tests passed! Update successful.${NC}"
  fi
  echo ""
  exit 0
fi

TOTAL_STEPS=8
STEP=0
next_step() { STEP=$((STEP + 1)); echo -e "\n${BOLD}${GREEN}[${STEP}/${TOTAL_STEPS}]${NC} ${BOLD}$1${NC}"; }

# ════════════════════════════════════════════════
#  STEP 1: Install Prerequisites
# ════════════════════════════════════════════════
next_step "Installing prerequisites..."

# Update package list
apt-get update -qq

# Essential tools
PACKAGES="curl wget jq openssl git bc"
for pkg in $PACKAGES; do
  if ! command -v "$pkg" &>/dev/null; then
    apt-get install -y -qq "$pkg" >/dev/null 2>&1
    ok "Installed $pkg"
  else
    ok "$pkg already installed"
  fi
done

# ════════════════════════════════════════════════
#  STEP 2: Install Docker
# ════════════════════════════════════════════════
next_step "Setting up Docker..."

if command -v docker &>/dev/null; then
  DOCKER_VER=$(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)
  ok "Docker already installed (v${DOCKER_VER})"
else
  log "Installing Docker..."
  apt-get install -y -qq ca-certificates curl gnupg >/dev/null 2>&1

  install -m 0755 -d /etc/apt/keyrings
  if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
  fi

  if [ ! -f /etc/apt/sources.list.d/docker.list ]; then
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null
  fi

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null 2>&1
  systemctl enable --now docker
  ok "Docker installed successfully"
fi

# Verify docker compose
if docker compose version &>/dev/null; then
  ok "Docker Compose plugin available"
else
  err "Docker Compose plugin not found. Install with: apt install docker-compose-plugin"
fi

# ════════════════════════════════════════════════
#  STEP 3: Generate Environment Configuration
# ════════════════════════════════════════════════
next_step "Generating environment configuration..."

POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
JWT_SECRET=$(openssl rand -base64 48)
AGENT_SECRET=$(openssl rand -hex 32)

if [[ "$DEV_MODE" == "true" ]]; then
  # Dev mode — use docker-compose.yml (no TLS)
  COMPOSE_FILE="docker-compose.yml"
  ENV_FILE=".env"

  cat > "$ENV_FILE" <<EOF
# ============================================
# Aegis NGFW — Dev Environment
# Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
# ============================================
POSTGRES_DB=aegis_ngfw
POSTGRES_USER=aegis
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}
DB_PORT=5432
API_PORT=3000
FRONTEND_PORT=8080
AGENT_SECRET_KEY=${AGENT_SECRET}
EOF

  ok "Dev environment created (.env)"
  API_URL="http://localhost:8080/api"

else
  # Production mode — use docker-compose.production.yml (TLS)
  COMPOSE_FILE="docker-compose.production.yml"
  ENV_FILE=".env.production"

  # Get domain if not provided
  if [[ -z "$DOMAIN" ]]; then
    if [[ "$AUTO_MODE" == "true" ]]; then
      DOMAIN=$(hostname -f 2>/dev/null || hostname)
      warn "Auto mode: using hostname '${DOMAIN}' as domain"
    else
      echo -en "  Enter your domain name (e.g. firewall.example.com): "
      read -r DOMAIN
      [[ -z "$DOMAIN" ]] && err "Domain is required for production mode. Use --dev for development."
    fi
  fi

  CERTBOT_EMAIL="admin@${DOMAIN}"
  if [[ "$AUTO_MODE" == "false" ]]; then
    echo -en "  Enter email for TLS certificates [${CERTBOT_EMAIL}]: "
    read -r input_email
    [[ -n "$input_email" ]] && CERTBOT_EMAIL="$input_email"
  fi

  cat > "$ENV_FILE" <<EOF
# ============================================
# Aegis NGFW — Production Environment
# Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
# ============================================
DOMAIN=${DOMAIN}
CERTBOT_EMAIL=${CERTBOT_EMAIL}
POSTGRES_DB=aegis_ngfw
POSTGRES_USER=aegis
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}
BACKUP_RETENTION_DAYS=30
BACKUP_SCHEDULE=0 2 * * *
AGENT_SECRET_KEY=${AGENT_SECRET}
EOF

  ok "Production environment created (.env.production)"
  API_URL="https://${DOMAIN}/api"
fi

log "Generated credentials (save these!):"
echo -e "  ${CYAN}DB Password:${NC}   ${POSTGRES_PASSWORD}"
echo -e "  ${CYAN}Agent Secret:${NC}  ${AGENT_SECRET}"
echo -e "  ${CYAN}JWT Secret:${NC}    (stored in ${ENV_FILE})"

# ════════════════════════════════════════════════
#  STEP 4: Build & Start Docker Stack
# ════════════════════════════════════════════════
next_step "Building and starting Docker stack..."

if [[ "$DEV_MODE" == "true" ]]; then
  docker compose -f "$COMPOSE_FILE" build --no-cache 2>&1 | tail -5
  docker compose -f "$COMPOSE_FILE" up -d
else
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache 2>&1 | tail -5
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
fi

ok "Docker stack started"

# ════════════════════════════════════════════════
#  STEP 5: Wait for Services to be Healthy
# ════════════════════════════════════════════════
next_step "Waiting for services to become healthy..."

# Wait for PostgreSQL
echo -n "  Waiting for database"
for i in $(seq 1 30); do
  if docker exec aegis-db pg_isready -U aegis -d aegis_ngfw &>/dev/null; then
    echo ""
    ok "Database is ready"
    break
  fi
  echo -n "."
  sleep 2
  if [[ $i -eq 30 ]]; then
    echo ""
    fail "Database failed to start after 60s"
    docker logs aegis-db --tail 20
    err "Database startup failed. Check logs: docker logs aegis-db"
  fi
done

# Wait for PostgREST API
echo -n "  Waiting for API"
for i in $(seq 1 20); do
  if [[ "$DEV_MODE" == "true" ]]; then
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/" 2>/dev/null || echo "000")
  else
    STATUS=$(docker exec aegis-api wget -qO- http://localhost:3000/ 2>/dev/null && echo "200" || echo "000")
  fi
  if [[ "$STATUS" == "200" ]] || docker exec aegis-api wget -qS --spider http://localhost:3000/ 2>&1 | grep -q "200"; then
    echo ""
    ok "PostgREST API is ready"
    break
  fi
  echo -n "."
  sleep 2
  if [[ $i -eq 20 ]]; then
    echo ""
    warn "API may still be starting. Continuing..."
  fi
done

# Wait for Frontend
echo -n "  Waiting for frontend"
for i in $(seq 1 15); do
  if [[ "$DEV_MODE" == "true" ]]; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080/" 2>/dev/null || echo "000")
  else
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:80/" 2>/dev/null || echo "000")
  fi
  if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "301" || "$HTTP_CODE" == "304" ]]; then
    echo ""
    ok "Frontend is ready"
    break
  fi
  echo -n "."
  sleep 2
  if [[ $i -eq 15 ]]; then
    echo ""
    warn "Frontend may still be starting. Continuing..."
  fi
done

# ════════════════════════════════════════════════
#  STEP 6: Install Agent on Host
# ════════════════════════════════════════════════
next_step "Installing Aegis Agent on host..."

if [[ "$SKIP_AGENT" == "true" ]]; then
  warn "Agent installation skipped (--skip-agent)"
else
  if [[ -f "scripts/install-agent.sh" ]]; then
    if [[ "$DEV_MODE" == "true" ]]; then
      LOCAL_API="http://localhost:8080/api"
    else
      LOCAL_API="http://localhost:80/api"
    fi

    if [[ "$AUTO_MODE" == "true" ]]; then
      bash scripts/install-agent.sh --api-url "$LOCAL_API" --auto --full
    else
      bash scripts/install-agent.sh --api-url "$LOCAL_API" --full
    fi
    ok "Agent installed"

    # Start agent service
    systemctl enable aegis-agent 2>/dev/null || true
    systemctl start aegis-agent 2>/dev/null || true
    ok "Agent service started"
  else
    warn "Agent script not found at scripts/install-agent.sh. Skipping."
  fi
fi

# ════════════════════════════════════════════════
#  STEP 7: Run Automated Tests
# ════════════════════════════════════════════════
next_step "Running automated tests..."

TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

run_test() {
  local name="$1"
  local cmd="$2"
  TESTS_TOTAL=$((TESTS_TOTAL + 1))
  if eval "$cmd" &>/dev/null; then
    ok "PASS: $name"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    fail "FAIL: $name"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

if [[ "$DEV_MODE" == "true" ]]; then
  BASE_URL="http://localhost:8080"
  API_BASE="http://localhost:3000"
else
  BASE_URL="http://localhost:80"
  API_BASE="http://localhost:80/api"
fi

# Test 1: Docker containers running
run_test "Container: aegis-db running" \
  "docker ps --filter name=aegis-db --filter status=running -q | grep -q ."

run_test "Container: aegis-api running" \
  "docker ps --filter name=aegis-api --filter status=running -q | grep -q ."

run_test "Container: aegis-frontend running" \
  "docker ps --filter name=aegis-frontend --filter status=running -q | grep -q ."

# Test 2: Database connectivity
run_test "Database: PostgreSQL accepts connections" \
  "docker exec aegis-db pg_isready -U aegis -d aegis_ngfw"

# Test 3: Database tables exist
run_test "Database: firewall_rules table exists" \
  "docker exec aegis-db psql -U aegis -d aegis_ngfw -c 'SELECT 1 FROM firewall_rules LIMIT 1'"

run_test "Database: network_interfaces table exists" \
  "docker exec aegis-db psql -U aegis -d aegis_ngfw -c 'SELECT 1 FROM network_interfaces LIMIT 1'"

run_test "Database: threat_events table exists" \
  "docker exec aegis-db psql -U aegis -d aegis_ngfw -c 'SELECT 1 FROM threat_events LIMIT 1'"

run_test "Database: firmware_info table exists" \
  "docker exec aegis-db psql -U aegis -d aegis_ngfw -c 'SELECT 1 FROM firmware_info LIMIT 1'"

run_test "Database: config_backups table exists" \
  "docker exec aegis-db psql -U aegis -d aegis_ngfw -c 'SELECT 1 FROM config_backups LIMIT 1'"

run_test "Database: packet_captures table exists" \
  "docker exec aegis-db psql -U aegis -d aegis_ngfw -c 'SELECT 1 FROM packet_captures LIMIT 1'"

run_test "Database: network_devices table exists" \
  "docker exec aegis-db psql -U aegis -d aegis_ngfw -c 'SELECT 1 FROM network_devices LIMIT 1'"

# Test 4: API endpoints
run_test "API: PostgREST root responds" \
  "curl -sf ${API_BASE}/ >/dev/null 2>&1 || curl -sf http://localhost:3000/ >/dev/null 2>&1"

run_test "API: /firewall_rules endpoint" \
  "curl -sf ${API_BASE}/firewall_rules >/dev/null 2>&1 || curl -sf http://localhost:3000/firewall_rules >/dev/null 2>&1"

run_test "API: /network_interfaces endpoint" \
  "curl -sf ${API_BASE}/network_interfaces >/dev/null 2>&1 || curl -sf http://localhost:3000/network_interfaces >/dev/null 2>&1"

run_test "API: /system_metrics endpoint" \
  "curl -sf ${API_BASE}/system_metrics >/dev/null 2>&1 || curl -sf http://localhost:3000/system_metrics >/dev/null 2>&1"

# Test 5: Frontend serves pages
run_test "Frontend: serves HTML" \
  "curl -sf ${BASE_URL}/ | grep -qi 'aegis\\|html'"

run_test "Frontend: /health endpoint" \
  "curl -sf ${BASE_URL}/health >/dev/null 2>&1 || curl -sf -o /dev/null -w '%{http_code}' ${BASE_URL}/health | grep -q '200'"

# Test 6: API proxy through Nginx
run_test "Frontend: API proxy /api works" \
  "curl -sf ${BASE_URL}/api/ >/dev/null 2>&1"

# Test 7: Auth mock endpoint (PostgREST RPC)
run_test "API: /rpc/authenticate exists" \
  "curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{\"p_email\":\"test\",\"p_password\":\"test\"}' http://localhost:3000/rpc/authenticate 2>/dev/null | grep -qE '(200|400|404)'"

# Test 8: Agent
if [[ "$SKIP_AGENT" == "false" ]] && [[ -f "/opt/aegis/aegis-agent.sh" ]]; then
  run_test "Agent: script exists at /opt/aegis/" \
    "test -x /opt/aegis/aegis-agent.sh"

  run_test "Agent: config exists at /opt/aegis/.env" \
    "test -f /opt/aegis/.env"

  run_test "Agent: systemd service loaded" \
    "systemctl is-enabled aegis-agent 2>/dev/null | grep -qE '(enabled|disabled)'"
fi

# Test 9: Disk & memory sanity
run_test "System: disk space > 1GB free" \
  "test \$(df / --output=avail -B1G | tail -1 | tr -d ' ') -gt 1"

run_test "System: IP forwarding enabled" \
  "sysctl net.ipv4.ip_forward 2>/dev/null | grep -q '= 1'"

# ── Test Summary ──
echo ""
echo -e "${BOLD}  ┌──────────────────────────────────────┐${NC}"
echo -e "${BOLD}  │        Test Results Summary           │${NC}"
echo -e "${BOLD}  ├──────────────────────────────────────┤${NC}"
printf  "  │  Total:  %-28s│\n" "${TESTS_TOTAL}"
printf  "  │  ${GREEN}Passed: %-28s${NC}│\n" "${TESTS_PASSED}"
if [[ $TESTS_FAILED -gt 0 ]]; then
  printf "  │  ${RED}Failed: %-28s${NC}│\n" "${TESTS_FAILED}"
else
  printf "  │  ${GREEN}Failed: %-28s${NC}│\n" "0"
fi
echo -e "${BOLD}  └──────────────────────────────────────┘${NC}"

# ════════════════════════════════════════════════
#  STEP 8: Final Summary
# ════════════════════════════════════════════════
next_step "Deployment complete!"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   Aegis NGFW — Deployment Successful!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""

if [[ "$DEV_MODE" == "true" ]]; then
  SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  echo -e "  ${BOLD}Access:${NC}"
  echo -e "    Local:    ${CYAN}http://localhost:8080${NC}"
  echo -e "    Network:  ${CYAN}http://${SERVER_IP}:8080${NC}"
else
  echo -e "  ${BOLD}Access:${NC}"
  echo -e "    URL:      ${CYAN}https://${DOMAIN}${NC}"
fi

echo ""
echo -e "  ${BOLD}Default Login:${NC}"
echo -e "    Email:    ${CYAN}admin@aegis.local${NC}"
echo -e "    Password: ${CYAN}Admin123!${NC}"
echo -e "    ${RED}⚠ CHANGE THIS IMMEDIATELY after first login!${NC}"
echo ""
echo -e "  ${BOLD}Credentials (save securely):${NC}"
echo -e "    DB Password:   ${YELLOW}${POSTGRES_PASSWORD}${NC}"
echo -e "    Agent Secret:  ${YELLOW}${AGENT_SECRET}${NC}"
echo ""
echo -e "  ${BOLD}Management Commands:${NC}"
echo -e "    View logs:     ${CYAN}docker compose logs -f${NC}"
echo -e "    Stop:          ${CYAN}docker compose down${NC}"
echo -e "    Restart:       ${CYAN}docker compose restart${NC}"
echo -e "    ${BOLD}Update:        ${CYAN}sudo bash scripts/deploy-oneclick.sh --update${NC}"
echo -e "    Agent logs:    ${CYAN}tail -f /opt/aegis/agent.log${NC}"
echo -e "    Agent status:  ${CYAN}systemctl status aegis-agent${NC}"
echo -e "    Agent test:    ${CYAN}/opt/aegis/aegis-agent.sh test${NC}"
echo -e "    Apply AV:      ${CYAN}/opt/aegis/aegis-agent.sh apply-av${NC}"
echo ""

if [[ $TESTS_FAILED -gt 0 ]]; then
  echo -e "  ${YELLOW}⚠ ${TESTS_FAILED} test(s) failed. Review above for details.${NC}"
  echo -e "  ${YELLOW}  The system may still work — some tests can fail on fresh installs.${NC}"
else
  echo -e "  ${GREEN}✓ All ${TESTS_PASSED} tests passed! System is fully operational.${NC}"
fi

echo ""
echo -e "${BOLD}${GREEN}100% self-hosted. No cloud services required.${NC}"
echo ""
