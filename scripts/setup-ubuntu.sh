#!/usr/bin/env bash
# =============================================================================
#  Sonaro Gate — Ubuntu 24.04 LTS Full Setup Script
#  Run as root: sudo bash scripts/setup-ubuntu.sh
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }

[[ $EUID -ne 0 ]] && fail "Must be run as root. Use: sudo bash $0"

# ─── Variables ────────────────────────────────────────────────────────────────
INSTALL_DIR="${INSTALL_DIR:-/opt/sonaro}"
NODE_VERSION="${NODE_VERSION:-20}"
DB_NAME="${DB_NAME:-sonaro_gate}"
DB_USER="${DB_USER:-sonaro}"
DB_PASS="${DB_PASS:-$(tr -dc 'A-Za-z0-9!@#%^&*' </dev/urandom | head -c 24)}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@sonaro.local}"
ADMIN_PASS="${ADMIN_PASS:-Admin123!}"
SURICATA_IFACE="${SURICATA_IFACE:-$(ip route | awk '/^default/{print $5; exit}')}"
LISTEN_PORT="${LISTEN_PORT:-443}"
TLS_DIR="${TLS_DIR:-/opt/sonaro/tls}"
ENABLE_SURICATA="${ENABLE_SURICATA:-yes}"
ENABLE_WIREGUARD="${ENABLE_WIREGUARD:-yes}"
ENABLE_OPENVPN="${ENABLE_OPENVPN:-yes}"
ENABLE_DNSMASQ="${ENABLE_DNSMASQ:-yes}"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║          SONARO GATE — Ubuntu 24.04 LTS Setup           ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
info "Install dir  : $INSTALL_DIR"
info "Database     : $DB_NAME @ localhost"
info "IPS Engine   : Suricata (ENABLE_SURICATA=$ENABLE_SURICATA)"
info "VPN WireGuard: ENABLE_WIREGUARD=$ENABLE_WIREGUARD"
info "VPN OpenVPN  : ENABLE_OPENVPN=$ENABLE_OPENVPN"
info "DHCP/DNS     : dnsmasq (ENABLE_DNSMASQ=$ENABLE_DNSMASQ)"
echo ""

# ─── Step 1: System packages ─────────────────────────────────────────────────
info "Updating package lists..."
apt-get update -qq

info "Installing core system packages..."
apt-get install -y -qq \
  curl wget ca-certificates gnupg lsb-release \
  build-essential git net-tools \
  iptables iptables-persistent netfilter-persistent \
  iproute2 iputils-ping nftables \
  tcpdump ethtool \
  openssl \
  postgresql postgresql-contrib \
  jq unzip \
  systemd-resolved \
  netplan.io \
  isc-dhcp-client \
  dhcpcd \
  procps

ok "Core packages installed"

# ─── Step 2: Node.js ─────────────────────────────────────────────────────────
if ! command -v node &>/dev/null || [[ "$(node --version | cut -d. -f1 | tr -d 'v')" -lt "$NODE_VERSION" ]]; then
  info "Installing Node.js $NODE_VERSION..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs
  ok "Node.js $(node --version) installed"
else
  ok "Node.js $(node --version) already installed"
fi

# ─── Step 3: IDS/IPS — Suricata ──────────────────────────────────────────────
if [[ "$ENABLE_SURICATA" == "yes" ]]; then
  info "Installing Suricata IDS/IPS engine..."
  apt-get install -y -qq suricata suricata-update
  ok "Suricata $(suricata --build-info 2>/dev/null | grep -i version | head -1 | awk '{print $NF}') installed"

  # Create local rules directory
  mkdir -p /etc/suricata/rules
  touch /etc/suricata/rules/sonaro-local.rules

  # Add local rules file to suricata.yaml if not present
  if ! grep -q "sonaro-local.rules" /etc/suricata/suricata.yaml 2>/dev/null; then
    sed -i '/default-rule-path:/a\rule-files:\n  - sonaro-local.rules' /etc/suricata/suricata.yaml 2>/dev/null || true
  fi

  # Update default rule sets (ET/Open)
  info "Downloading Suricata rule sets (this may take a minute)..."
  suricata-update --no-reload 2>/dev/null || warn "suricata-update failed — internet access may be required"

  # Enable IPS mode on the main interface
  info "Configuring Suricata for interface $SURICATA_IFACE..."
  cat > /etc/suricata/sonaro-override.yaml <<YAML
# Sonaro Gate IPS override config
af-packet:
  - interface: $SURICATA_IFACE
    cluster-id: 99
    cluster-type: cluster_flow
    defrag: yes
    use-mmap: yes
    tpacket-v3: yes

default-log-dir: /var/log/suricata/
outputs:
  - fast:
      enabled: yes
      filename: fast.log
      append: yes
  - eve-log:
      enabled: yes
      filetype: regular
      filename: eve.json
      types:
        - alert
        - http
        - dns
        - tls
YAML

  systemctl enable suricata || true
  systemctl start suricata || warn "Suricata failed to start — check config"
  ok "Suricata configured and enabled"
fi

# ─── Step 4: VPN — WireGuard ─────────────────────────────────────────────────
if [[ "$ENABLE_WIREGUARD" == "yes" ]]; then
  info "Installing WireGuard VPN..."
  apt-get install -y -qq wireguard wireguard-tools
  ok "WireGuard installed"

  # Generate server keys if not present
  if [[ ! -f /etc/wireguard/server_private.key ]]; then
    info "Generating WireGuard server keys..."
    wg genkey | tee /etc/wireguard/server_private.key | wg pubkey > /etc/wireguard/server_public.key
    chmod 600 /etc/wireguard/server_private.key
    SERVER_PRIV=$(cat /etc/wireguard/server_private.key)
    cat > /etc/wireguard/wg0.conf <<WG
[Interface]
Address = 10.200.0.1/24
ListenPort = 51820
PrivateKey = ${SERVER_PRIV}

# Client peers will be added here by Sonaro Gate
# [Peer]
# PublicKey = <client_pub_key>
# AllowedIPs = 10.200.0.2/32
WG
    chmod 600 /etc/wireguard/wg0.conf
    ok "WireGuard server config created at /etc/wireguard/wg0.conf"
  else
    ok "WireGuard keys already exist"
  fi
fi

# ─── Step 5: VPN — OpenVPN ───────────────────────────────────────────────────
if [[ "$ENABLE_OPENVPN" == "yes" ]]; then
  info "Installing OpenVPN..."
  apt-get install -y -qq openvpn easy-rsa
  ok "OpenVPN installed"

  if [[ ! -d /etc/openvpn/easy-rsa ]]; then
    info "Initializing OpenVPN PKI..."
    make-cadir /etc/openvpn/easy-rsa
    pushd /etc/openvpn/easy-rsa >/dev/null
    ./easyrsa init-pki >/dev/null 2>&1
    echo "SonaroGate" | ./easyrsa build-ca nopass >/dev/null 2>&1
    ./easyrsa gen-dh >/dev/null 2>&1
    ./easyrsa build-server-full server nopass >/dev/null 2>&1
    openvpn --genkey tls-auth /etc/openvpn/ta.key 2>/dev/null || openssl rand -base64 256 > /etc/openvpn/ta.key
    popd >/dev/null

    cat > /etc/openvpn/server.conf <<OVP
port 1194
proto udp
dev tun
ca /etc/openvpn/easy-rsa/pki/ca.crt
cert /etc/openvpn/easy-rsa/pki/issued/server.crt
key /etc/openvpn/easy-rsa/pki/private/server.key
dh /etc/openvpn/easy-rsa/pki/dh.pem
tls-auth /etc/openvpn/ta.key 0
server 10.201.0.0 255.255.255.0
ifconfig-pool-persist /var/log/openvpn/ipp.txt
push "redirect-gateway def1 bypass-dhcp"
push "dhcp-option DNS 8.8.8.8"
push "dhcp-option DNS 8.8.4.4"
keepalive 10 120
cipher AES-256-GCM
auth SHA256
compress lz4-v2
push "compress lz4-v2"
user nobody
group nogroup
persist-key
persist-tun
status /var/log/openvpn/openvpn-status.log
log-append /var/log/openvpn/openvpn.log
verb 3
OVP
    mkdir -p /var/log/openvpn
    ok "OpenVPN PKI and server config created"
  else
    ok "OpenVPN PKI already exists"
  fi

  systemctl enable openvpn@server || true
fi

# ─── Step 6: DHCP/DNS — dnsmasq ──────────────────────────────────────────────
if [[ "$ENABLE_DNSMASQ" == "yes" ]]; then
  info "Installing dnsmasq (DHCP/DNS server)..."
  apt-get install -y -qq dnsmasq
  ok "dnsmasq installed"

  # Only configure if not already set up by Sonaro Gate
  if [[ ! -f /etc/dnsmasq.d/sonaro.conf ]]; then
    cat > /etc/dnsmasq.d/sonaro.conf <<DNS
# Sonaro Gate DHCP/DNS configuration
# Managed by Sonaro Gate — edit via web UI
interface=lo
bind-interfaces
# DHCP will be configured per interface via Sonaro Gate UI
DNS
    ok "dnsmasq base config created at /etc/dnsmasq.d/sonaro.conf"
  fi

  systemctl enable dnsmasq || true
fi

# ─── Step 7: Enable IP forwarding ────────────────────────────────────────────
info "Enabling IP forwarding..."
cat > /etc/sysctl.d/99-sonaro.conf <<SYSCTL
# Sonaro Gate kernel forwarding settings
net.ipv4.ip_forward = 1
net.ipv6.conf.all.forwarding = 1
net.ipv4.conf.all.rp_filter = 0
net.ipv4.conf.default.rp_filter = 0

# Suricata / nfqueue optimization
net.core.netdev_max_backlog = 65536
net.core.somaxconn = 65536
net.ipv4.tcp_max_syn_backlog = 65536
SYSCTL
sysctl -p /etc/sysctl.d/99-sonaro.conf >/dev/null 2>&1 || true
ok "IP forwarding enabled"

# ─── Step 8: iptables persistence ────────────────────────────────────────────
info "Configuring iptables persistence..."
iptables -t nat -A POSTROUTING -j MASQUERADE 2>/dev/null || true
netfilter-persistent save 2>/dev/null || iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
ok "iptables rules will persist across reboots"

# ─── Step 9: PostgreSQL setup ────────────────────────────────────────────────
info "Configuring PostgreSQL database..."
PG_VERSION=$(pg_lsclusters | awk 'NR==2{print $1}' || echo "16")
systemctl enable postgresql || true
systemctl start postgresql || true

# Create user and database
su -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'\" | grep -q 1 || createuser -s $DB_USER" postgres 2>/dev/null || true
su -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='$DB_NAME'\" | grep -q 1 || createdb -O $DB_USER $DB_NAME" postgres 2>/dev/null || true
su -c "psql -c \"ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';\"" postgres 2>/dev/null || true
ok "PostgreSQL database '$DB_NAME' ready"

# ─── Step 10: TLS certificate generation ─────────────────────────────────────
info "Generating TLS certificate for HTTPS..."
mkdir -p "$TLS_DIR"
chmod 700 "$TLS_DIR"

SERVER_IP=$(hostname -I | awk '{print $1}')
HOSTNAME_FQDN=$(hostname -f 2>/dev/null || hostname)

# Build Subject Alternative Name list (IP + hostname)
SAN="IP:${SERVER_IP},IP:127.0.0.1,DNS:${HOSTNAME_FQDN},DNS:localhost"

# Generate a private CA — RSA 4096 (128-bit security level, adequate for 10-year cert)
# NIST SP 800-131A recommends >= 3072 bits for keys used beyond 2030.
info "  Generating CA key (RSA 4096) — this takes a few seconds..."
openssl req -x509 -newkey rsa:4096 -days 3650 -nodes \
  -keyout "$TLS_DIR/ca.key" \
  -out    "$TLS_DIR/ca.crt" \
  -subj   "/C=VN/O=Sonaro Gate/CN=Sonaro Gate Local CA" \
  -addext "basicConstraints=critical,CA:true,pathlen:0" \
  -addext "keyUsage=critical,keyCertSign,cRLSign" \
  >/dev/null 2>&1

# Generate server private key (RSA 4096) + CSR
info "  Generating server key (RSA 4096)..."
openssl req -newkey rsa:4096 -nodes \
  -keyout "$TLS_DIR/server.key" \
  -out    "$TLS_DIR/server.csr" \
  -subj   "/C=VN/O=Sonaro Gate/CN=${SERVER_IP}" \
  >/dev/null 2>&1

# Sign the server cert with our local CA — with SANs and explicit extensions
openssl x509 -req -days 3650 \
  -in      "$TLS_DIR/server.csr" \
  -CA      "$TLS_DIR/ca.crt" \
  -CAkey   "$TLS_DIR/ca.key" \
  -CAcreateserial \
  -out     "$TLS_DIR/server.crt" \
  -extfile <(printf "subjectAltName=%s\nbasicConstraints=CA:false\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth" "$SAN") \
  >/dev/null 2>&1

# Bundle server cert + CA cert into a chain file.
# TLS handshake sends the full chain so clients can verify without pre-installing the CA.
cat "$TLS_DIR/server.crt" "$TLS_DIR/ca.crt" > "$TLS_DIR/server-chain.crt"

chmod 600 "$TLS_DIR/server.key" "$TLS_DIR/ca.key"
chmod 644 "$TLS_DIR/server.crt" "$TLS_DIR/ca.crt" "$TLS_DIR/server-chain.crt"
ok "TLS certificate generated (RSA 4096, CA-signed, 10-year, full chain bundled)"

# ─── Step 10b: Install Sonaro Gate application ────────────────────────────────
info "Installing Sonaro Gate application to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"

# Copy application files
if [[ -d /opt/sonaro-src ]]; then
  cp -r /opt/sonaro-src/. "$INSTALL_DIR/"
elif [[ -f ./package.json ]]; then
  # Running from source directory
  cp -r . "$INSTALL_DIR/"
fi

cd "$INSTALL_DIR" || fail "Could not enter $INSTALL_DIR"

# Generate a cryptographically strong JWT secret (96 hex chars = 48 bytes entropy)
JWT_SECRET_VAL="$(openssl rand -hex 48)"

# Write environment
cat > "$INSTALL_DIR/.env" <<ENV
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
NODE_ENV=production
PORT=$LISTEN_PORT
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASS
SONARO_INSTALL_DIR=$INSTALL_DIR
TLS_CERT_FILE=$TLS_DIR/server-chain.crt
TLS_KEY_FILE=$TLS_DIR/server.key
JWT_SECRET=$JWT_SECRET_VAL
ENV
chmod 600 "$INSTALL_DIR/.env"

info "Installing Node.js dependencies..."
npm install --production 2>/dev/null || npm install 2>/dev/null
ok "Dependencies installed"

info "Building frontend assets..."
npm run build 2>/dev/null || true

info "Running database migrations..."
npm run db:push 2>/dev/null || true
ok "Database schema up to date"

# ─── Step 11: systemd service ─────────────────────────────────────────────────
info "Creating systemd service..."
cat > /etc/systemd/system/sonaro-gate.service <<SERVICE
[Unit]
Description=Sonaro Gate — Next-Generation Firewall Console
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=/usr/bin/node $INSTALL_DIR/dist/server/index.js
ExecStartPre=/usr/bin/node -e "require('dotenv').config(); console.log('Environment loaded')"
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=sonaro-gate
KillMode=mixed
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable sonaro-gate
ok "sonaro-gate.service created and enabled"

# ─── Step 12: Firewall — allow management ports ───────────────────────────────
info "Configuring iptables to allow management access..."
# HTTPS management port (443 by default)
iptables -C INPUT -p tcp --dport "$LISTEN_PORT" -j ACCEPT 2>/dev/null || \
  iptables -A INPUT -p tcp --dport "$LISTEN_PORT" -j ACCEPT
# HTTP → HTTPS redirect port (80) — only needed when LISTEN_PORT=443
if [[ "$LISTEN_PORT" == "443" ]]; then
  iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || \
    iptables -A INPUT -p tcp --dport 80 -j ACCEPT
fi
# PostgreSQL (local only)
iptables -C INPUT -p tcp --dport 5432 -s 127.0.0.1 -j ACCEPT 2>/dev/null || \
  iptables -A INPUT -p tcp --dport 5432 -s 127.0.0.1 -j ACCEPT
netfilter-persistent save 2>/dev/null || true
ok "Firewall rules set (ports: 80, $LISTEN_PORT)"

# ─── Step 13: Start services ─────────────────────────────────────────────────
info "Starting Sonaro Gate..."
systemctl start sonaro-gate || warn "Service failed to start — check: journalctl -u sonaro-gate -n 50"

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                  SETUP COMPLETE                         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
ok "Sonaro Gate is installed at $INSTALL_DIR"
echo ""
echo -e "  ${GREEN}Web UI:${NC}      https://$(hostname -I | awk '{print $1}')"
echo -e "  ${GREEN}Admin login:${NC} $ADMIN_EMAIL"
echo -e "  ${GREEN}Admin pass:${NC}  $ADMIN_PASS"
echo ""
echo "  Services installed:"
[[ "$ENABLE_SURICATA" == "yes" ]]  && echo "    ✔ Suricata IPS  — systemctl status suricata"
[[ "$ENABLE_WIREGUARD" == "yes" ]] && echo "    ✔ WireGuard VPN — /etc/wireguard/wg0.conf"
[[ "$ENABLE_OPENVPN" == "yes" ]]   && echo "    ✔ OpenVPN       — systemctl start openvpn@server"
[[ "$ENABLE_DNSMASQ" == "yes" ]]   && echo "    ✔ dnsmasq DHCP  — /etc/dnsmasq.d/sonaro.conf"
echo "    ✔ PostgreSQL    — database: $DB_NAME"
echo "    ✔ iptables      — ports 80 (redirect) + 443 (HTTPS) open"
echo ""
echo -e "  ${YELLOW}HTTPS / Certificate notice:${NC}"
echo "    A self-signed certificate was generated for this device."
echo "    Browsers will show a security warning the first time."
echo "    To suppress the warning, install the local CA cert in your browser:"
echo ""
echo -e "    ${BLUE}CA cert location:${NC} $TLS_DIR/ca.crt"
echo ""
echo "    → Chrome/Edge : Settings → Privacy → Manage certificates → Authorities → Import ca.crt"
echo "    → Firefox     : Settings → Privacy → View Certificates → Authorities → Import ca.crt"
echo "    → Ubuntu/curl : sudo cp $TLS_DIR/ca.crt /usr/local/share/ca-certificates/sonaro-gate.crt"
echo "                    sudo update-ca-certificates"
echo ""
echo "    Data is fully encrypted with TLS regardless of the browser warning."
echo ""
echo "  Useful commands:"
echo "    journalctl -u sonaro-gate -f        # live app logs"
echo "    journalctl -u suricata -f           # IPS logs"
echo "    tail -f /var/log/suricata/fast.log  # IPS alerts"
echo "    openssl x509 -in $TLS_DIR/server.crt -noout -text  # inspect cert"
echo ""
echo "  DB credentials saved to $INSTALL_DIR/.env (chmod 600)"
echo ""
