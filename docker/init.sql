-- ============================================
-- Aegis NGFW - Database Initialization
-- For self-hosted PostgreSQL deployment
-- ============================================

-- Create roles
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Role enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'operator', 'auditor');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── Users table (replaces auth.users for self-host) ──
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── User Roles ──
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- ── Firewall Rules ──
CREATE TABLE IF NOT EXISTS public.firewall_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_order INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  action TEXT NOT NULL DEFAULT 'block' CHECK (action IN ('pass', 'block', 'reject')),
  interface TEXT NOT NULL DEFAULT 'WAN',
  direction TEXT NOT NULL DEFAULT 'in' CHECK (direction IN ('in', 'out')),
  protocol TEXT NOT NULL DEFAULT 'any',
  source_type TEXT NOT NULL DEFAULT 'any',
  source_value TEXT NOT NULL DEFAULT '*',
  source_port TEXT,
  destination_type TEXT NOT NULL DEFAULT 'any',
  destination_value TEXT NOT NULL DEFAULT '*',
  destination_port TEXT,
  description TEXT NOT NULL DEFAULT '',
  logging BOOLEAN NOT NULL DEFAULT false,
  hits BIGINT NOT NULL DEFAULT 0,
  last_hit TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.users(id)
);

-- ── NAT Rules ──
CREATE TABLE IF NOT EXISTS public.nat_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'port-forward' CHECK (type IN ('port-forward', 'outbound', '1-to-1')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  interface TEXT NOT NULL DEFAULT 'WAN',
  protocol TEXT NOT NULL DEFAULT 'tcp',
  external_address TEXT,
  external_port TEXT NOT NULL DEFAULT '',
  internal_address TEXT NOT NULL DEFAULT '',
  internal_port TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.users(id)
);

-- ── Network Interfaces ──
CREATE TABLE IF NOT EXISTS public.network_interfaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'LAN' CHECK (type IN ('WAN', 'LAN', 'DMZ', 'OPT')),
  status TEXT NOT NULL DEFAULT 'up' CHECK (status IN ('up', 'down', 'disabled')),
  ip_address TEXT,
  subnet TEXT,
  gateway TEXT,
  mac TEXT,
  speed TEXT,
  duplex TEXT DEFAULT 'full',
  mtu INT DEFAULT 1500,
  vlan INT,
  rx_bytes BIGINT DEFAULT 0,
  tx_bytes BIGINT DEFAULT 0,
  rx_packets BIGINT DEFAULT 0,
  tx_packets BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── VPN Tunnels ──
CREATE TABLE IF NOT EXISTS public.vpn_tunnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'ipsec' CHECK (type IN ('ipsec', 'openvpn', 'wireguard')),
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'connecting')),
  remote_gateway TEXT,
  local_network TEXT,
  remote_network TEXT,
  bytes_in BIGINT DEFAULT 0,
  bytes_out BIGINT DEFAULT 0,
  uptime BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Threat Events ──
CREATE TABLE IF NOT EXISTS public.threat_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  category TEXT NOT NULL DEFAULT '',
  source_ip TEXT,
  destination_ip TEXT,
  source_port INT,
  destination_port INT,
  protocol TEXT,
  signature TEXT,
  description TEXT,
  action TEXT NOT NULL DEFAULT 'blocked' CHECK (action IN ('blocked', 'allowed', 'monitored')),
  ai_confidence DECIMAL(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── System Settings ──
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL DEFAULT '',
  description TEXT,
  is_auditable BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Static Routes ──
CREATE TABLE IF NOT EXISTS public.static_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destination TEXT NOT NULL,
  gateway TEXT NOT NULL,
  interface TEXT NOT NULL DEFAULT 'wan1',
  distance INT NOT NULL DEFAULT 10,
  priority INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled')),
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Policy Routes ──
CREATE TABLE IF NOT EXISTS public.policy_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seq INT NOT NULL DEFAULT 1,
  incoming TEXT NOT NULL DEFAULT 'internal',
  source TEXT NOT NULL DEFAULT '0.0.0.0/0',
  destination TEXT NOT NULL DEFAULT '0.0.0.0/0',
  protocol TEXT NOT NULL DEFAULT 'any',
  gateway TEXT NOT NULL DEFAULT '',
  out_interface TEXT NOT NULL DEFAULT 'wan1',
  status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled')),
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Aliases ──
CREATE TABLE IF NOT EXISTS public.aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'host' CHECK (type IN ('host', 'network', 'port')),
  values TEXT[] NOT NULL DEFAULT '{}',
  description TEXT NOT NULL DEFAULT '',
  usage_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Services ──
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Custom',
  protocol TEXT NOT NULL DEFAULT 'TCP' CHECK (protocol IN ('TCP', 'UDP', 'TCP/UDP', 'ICMP', 'IP')),
  dest_ports TEXT NOT NULL DEFAULT '',
  source_ports TEXT NOT NULL DEFAULT '1-65535',
  comment TEXT NOT NULL DEFAULT '',
  references_count INT NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Schedules ──
CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  days INT[] NOT NULL DEFAULT '{}',
  start_time TEXT NOT NULL DEFAULT '00:00',
  end_time TEXT NOT NULL DEFAULT '23:59',
  usage_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Certificates ──
CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'local' CHECK (type IN ('local', 'remote', 'ca', 'crl')),
  subject TEXT NOT NULL DEFAULT '',
  issuer TEXT NOT NULL DEFAULT '',
  serial_number TEXT NOT NULL DEFAULT '',
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to TIMESTAMPTZ NOT NULL DEFAULT now() + interval '1 year',
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'expired', 'expiring', 'revoked', 'pending')),
  key_type TEXT NOT NULL DEFAULT 'RSA',
  key_size INT NOT NULL DEFAULT 2048,
  in_use BOOLEAN NOT NULL DEFAULT false,
  used_by TEXT[] NOT NULL DEFAULT '{}',
  signature_algorithm TEXT NOT NULL DEFAULT 'SHA256withRSA',
  fingerprint TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── IDS/IPS Signatures ──
CREATE TABLE IF NOT EXISTS public.ids_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sid INT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  action TEXT NOT NULL DEFAULT 'alert' CHECK (action IN ('alert', 'drop', 'reject', 'pass', 'default', 'block', 'reset', 'monitor')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  hits BIGINT NOT NULL DEFAULT 0,
  last_hit TIMESTAMPTZ,
  description TEXT NOT NULL DEFAULT '',
  cve TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── DHCP Servers ──
CREATE TABLE IF NOT EXISTS public.dhcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interface TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  range_start TEXT NOT NULL DEFAULT '',
  range_end TEXT NOT NULL DEFAULT '',
  gateway TEXT NOT NULL DEFAULT '',
  netmask TEXT NOT NULL DEFAULT '255.255.255.0',
  dns1 TEXT NOT NULL DEFAULT '8.8.8.8',
  dns2 TEXT NOT NULL DEFAULT '8.8.4.4',
  domain TEXT NOT NULL DEFAULT '',
  lease_time INT NOT NULL DEFAULT 86400,
  active_leases INT NOT NULL DEFAULT 0,
  total_pool INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── DHCP Static Mappings ──
CREATE TABLE IF NOT EXISTS public.dhcp_static_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  mac TEXT NOT NULL,
  ip TEXT NOT NULL,
  interface TEXT NOT NULL DEFAULT 'LAN',
  enabled BOOLEAN NOT NULL DEFAULT true,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── DHCP Leases ──
CREATE TABLE IF NOT EXISTS public.dhcp_leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip TEXT NOT NULL,
  mac TEXT NOT NULL,
  hostname TEXT NOT NULL DEFAULT '',
  lease_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_end TIMESTAMPTZ NOT NULL DEFAULT now() + interval '1 day',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'static')),
  interface TEXT NOT NULL DEFAULT 'LAN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── DNS Filter Profiles ──
CREATE TABLE IF NOT EXISTS public.dns_filter_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  domain_filter BOOLEAN NOT NULL DEFAULT true,
  fortiguard_category BOOLEAN NOT NULL DEFAULT true,
  safe_search BOOLEAN NOT NULL DEFAULT true,
  youtube_restrict BOOLEAN NOT NULL DEFAULT false,
  log_all_domains BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT true,
  blocked_categories INT NOT NULL DEFAULT 0,
  references_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── DNS Forward Zones ──
CREATE TABLE IF NOT EXISTS public.dns_forward_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'forward',
  servers TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── DNS Local Records ──
CREATE TABLE IF NOT EXISTS public.dns_local_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostname TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'A',
  address TEXT NOT NULL DEFAULT '',
  ttl INT NOT NULL DEFAULT 3600,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── IP Pools ──
CREATE TABLE IF NOT EXISTS public.ip_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  comments TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'overload' CHECK (type IN ('overload', 'one-to-one', 'fixed-port-range', 'port-block-allocation')),
  start_ip TEXT NOT NULL DEFAULT '',
  end_ip TEXT NOT NULL DEFAULT '',
  associated_interface TEXT NOT NULL DEFAULT 'wan1',
  arp_reply BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT true,
  used_ips INT NOT NULL DEFAULT 0,
  total_ips INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Virtual IPs ──
CREATE TABLE IF NOT EXISTS public.virtual_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  comments TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'static-nat' CHECK (type IN ('static-nat', 'load-balance', 'server-load-balance', 'access-proxy')),
  external_ip TEXT NOT NULL DEFAULT '',
  mapped_ip TEXT NOT NULL DEFAULT '',
  interface TEXT NOT NULL DEFAULT 'wan1',
  protocol TEXT NOT NULL DEFAULT 'TCP',
  external_port TEXT NOT NULL DEFAULT '',
  mapped_port TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  sessions INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Wildcard FQDNs ──
CREATE TABLE IF NOT EXISTS public.wildcard_fqdns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  fqdn TEXT NOT NULL,
  interface TEXT NOT NULL DEFAULT 'any',
  comment TEXT NOT NULL DEFAULT '',
  visibility BOOLEAN NOT NULL DEFAULT true,
  references_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Traffic Shapers ──
CREATE TABLE IF NOT EXISTS public.traffic_shapers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'shared' CHECK (type IN ('shared', 'per-ip')),
  guaranteed_bandwidth INT NOT NULL DEFAULT 0,
  maximum_bandwidth INT NOT NULL DEFAULT 0,
  burst_bandwidth INT NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  per_policy BOOLEAN NOT NULL DEFAULT true,
  diffserv_forward BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  current_usage INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Traffic Shaping Policies ──
CREATE TABLE IF NOT EXISTS public.traffic_shaping_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  src_interface TEXT NOT NULL DEFAULT 'lan',
  dst_interface TEXT NOT NULL DEFAULT 'wan1',
  source TEXT NOT NULL DEFAULT 'all',
  destination TEXT NOT NULL DEFAULT 'all',
  service TEXT NOT NULL DEFAULT 'ALL',
  application TEXT NOT NULL DEFAULT '',
  traffic_shaper TEXT NOT NULL DEFAULT '',
  reverse_shaper TEXT NOT NULL DEFAULT '',
  per_ip_shaper TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  matches BIGINT NOT NULL DEFAULT 0,
  bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── SSL Inspection Profiles ──
CREATE TABLE IF NOT EXISTS public.ssl_inspection_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  inspection_mode TEXT NOT NULL DEFAULT 'certificate-inspection',
  https_enabled BOOLEAN NOT NULL DEFAULT true,
  smtps_enabled BOOLEAN NOT NULL DEFAULT false,
  pop3s_enabled BOOLEAN NOT NULL DEFAULT false,
  imaps_enabled BOOLEAN NOT NULL DEFAULT false,
  ftps_enabled BOOLEAN NOT NULL DEFAULT false,
  ca_certificate TEXT NOT NULL DEFAULT '',
  untrusted_cert_action TEXT NOT NULL DEFAULT 'allow',
  expired_cert_action TEXT NOT NULL DEFAULT 'allow',
  references_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── AV Profiles ──
CREATE TABLE IF NOT EXISTS public.av_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  http_scan BOOLEAN NOT NULL DEFAULT true,
  ftp_scan BOOLEAN NOT NULL DEFAULT true,
  imap_scan BOOLEAN NOT NULL DEFAULT true,
  pop3_scan BOOLEAN NOT NULL DEFAULT true,
  smtp_scan BOOLEAN NOT NULL DEFAULT true,
  action TEXT NOT NULL DEFAULT 'block' CHECK (action IN ('block', 'monitor', 'quarantine')),
  emulator_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Web Filter Profiles ──
CREATE TABLE IF NOT EXISTS public.web_filter_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL DEFAULT 'proxy' CHECK (mode IN ('proxy', 'flow', 'dns')),
  action TEXT NOT NULL DEFAULT 'block' CHECK (action IN ('block', 'warning', 'monitor')),
  url_filtering BOOLEAN NOT NULL DEFAULT true,
  safe_search BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Traffic Stats ──
CREATE TABLE IF NOT EXISTS public.traffic_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interface TEXT NOT NULL DEFAULT 'WAN',
  inbound INT NOT NULL DEFAULT 0,
  outbound INT NOT NULL DEFAULT 0,
  blocked INT NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_traffic_stats_recorded_at ON public.traffic_stats(recorded_at DESC);

-- ── System Metrics ──
CREATE TABLE IF NOT EXISTS public.system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostname TEXT NOT NULL DEFAULT '',
  uptime BIGINT NOT NULL DEFAULT 0,
  cpu_usage INT NOT NULL DEFAULT 0,
  cpu_cores INT NOT NULL DEFAULT 1,
  cpu_temperature INT NOT NULL DEFAULT 0,
  memory_total INT NOT NULL DEFAULT 0,
  memory_used INT NOT NULL DEFAULT 0,
  memory_free INT NOT NULL DEFAULT 0,
  memory_cached INT NOT NULL DEFAULT 0,
  disk_total INT NOT NULL DEFAULT 0,
  disk_used INT NOT NULL DEFAULT 0,
  disk_free INT NOT NULL DEFAULT 0,
  load_1m DECIMAL(5,2) NOT NULL DEFAULT 0,
  load_5m DECIMAL(5,2) NOT NULL DEFAULT 0,
  load_15m DECIMAL(5,2) NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_system_metrics_recorded_at ON public.system_metrics(recorded_at DESC);

-- ── AI Analysis ──
CREATE TABLE IF NOT EXISTS public.ai_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_score INT NOT NULL DEFAULT 0,
  anomalies_detected INT NOT NULL DEFAULT 0,
  threats_blocked INT NOT NULL DEFAULT 0,
  predictions JSONB NOT NULL DEFAULT '[]',
  recommendations JSONB NOT NULL DEFAULT '[]',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Audit Logs ──
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT '',
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── updated_at trigger function ──
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ── Enable pgcrypto for password hashing ──
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── JWT authenticate function ──
-- Called by the frontend via PostgREST: POST /rpc/authenticate
-- Verifies email+password, returns a JWT signed with PGRST_JWT_SECRET
CREATE OR REPLACE FUNCTION public.authenticate(p_email TEXT, p_password TEXT)
RETURNS JSON AS $$
DECLARE
  v_user   public.users%ROWTYPE;
  v_roles  TEXT[];
  v_token  TEXT;
  v_secret TEXT;
  v_header TEXT;
  v_payload TEXT;
  v_claims JSON;
BEGIN
  -- Find user
  SELECT * INTO v_user FROM public.users WHERE email = p_email;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid login credentials';
  END IF;

  -- Verify password (bcrypt)
  IF NOT (v_user.password_hash = crypt(p_password, v_user.password_hash)) THEN
    RAISE EXCEPTION 'Invalid login credentials';
  END IF;

  -- Get roles
  SELECT array_agg(role::TEXT) INTO v_roles
  FROM public.user_roles WHERE user_id = v_user.id;

  -- Read JWT secret from GUC (set by PostgREST via PGRST_JWT_SECRET)
  v_secret := current_setting('pgrst.jwt_secret', true);
  IF v_secret IS NULL OR v_secret = '' THEN
    v_secret := current_setting('app.jwt_secret', true);
  END IF;
  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE EXCEPTION 'JWT secret not configured';
  END IF;

  -- Build JWT manually (HS256)
  v_header := encode(convert_to('{"alg":"HS256","typ":"JWT"}', 'UTF8'), 'base64');
  v_header := replace(replace(rtrim(v_header, '='), '+', '-'), '/', '_');

  v_claims := json_build_object(
    'role', 'authenticated',
    'sub', v_user.id,
    'email', v_user.email,
    'full_name', v_user.full_name,
    'roles', COALESCE(v_roles, ARRAY[]::TEXT[]),
    'iat', extract(epoch from now())::int,
    'exp', extract(epoch from now() + interval '24 hours')::int
  );

  v_payload := encode(convert_to(v_claims::TEXT, 'UTF8'), 'base64');
  v_payload := replace(replace(rtrim(v_payload, '='), '+', '-'), '/', '_');

  v_token := v_header || '.' || v_payload || '.' ||
    replace(replace(rtrim(
      encode(hmac(v_header || '.' || v_payload, v_secret, 'sha256'), 'base64'),
    '='), '+', '-'), '/', '_');

  RETURN json_build_object(
    'token', v_token,
    'user_id', v_user.id,
    'email', v_user.email,
    'full_name', v_user.full_name,
    'roles', COALESCE(v_roles, ARRAY[]::TEXT[])
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── Role check functions ──
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin_or_super_admin(_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin', 'admin'));
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_operator_or_higher(_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin', 'admin', 'operator'));
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ── Grant permissions ──
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
-- Allow anon to call authenticate
GRANT EXECUTE ON FUNCTION public.authenticate(TEXT, TEXT) TO anon;

-- ── Agent write permissions (anon role for local agent without JWT) ──
-- The agent runs on the host and connects via PostgREST as anon role.
-- These tables need INSERT/UPDATE so the agent can push metrics and config.
GRANT INSERT, UPDATE ON public.system_metrics TO anon;
GRANT INSERT, UPDATE ON public.network_interfaces TO anon;
GRANT INSERT, UPDATE ON public.threat_events TO anon;
GRANT INSERT, UPDATE ON public.traffic_stats TO anon;
GRANT INSERT, UPDATE ON public.firmware_info TO anon;
GRANT INSERT, UPDATE ON public.config_backups TO anon;
GRANT INSERT, UPDATE ON public.network_devices TO anon;
GRANT INSERT, UPDATE ON public.packet_captures TO anon;
GRANT INSERT, UPDATE ON public.dhcp_leases TO anon;
GRANT INSERT, UPDATE ON public.ai_analysis TO anon;

-- ── Seed default admin user ──
-- Password: Admin123! (generated via crypt at init time)
INSERT INTO public.users (id, email, password_hash, full_name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@aegis.local', crypt('Admin123!', gen_salt('bf')), 'Super Admin')
ON CONFLICT (email) DO UPDATE SET password_hash = crypt('Admin123!', gen_salt('bf'));

INSERT INTO public.user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- ── Seed data for all tables ──
INSERT INTO public.network_interfaces (name, type, status, ip_address, subnet, gateway, mac, speed, mtu) VALUES
  ('WAN', 'WAN', 'up', '203.113.152.45', '255.255.255.0', '203.113.152.1', '00:1A:2B:3C:4D:5E', '1 Gbps', 1500),
  ('LAN', 'LAN', 'up', '192.168.1.1', '255.255.255.0', NULL, '00:1A:2B:3C:4D:5F', '1 Gbps', 1500),
  ('DMZ', 'DMZ', 'up', '10.0.0.1', '255.255.255.0', NULL, '00:1A:2B:3C:4D:60', '1 Gbps', 1500),
  ('GUEST', 'OPT', 'up', '172.16.0.1', '255.255.255.0', NULL, '00:1A:2B:3C:4D:61', '100 Mbps', 1500)
ON CONFLICT DO NOTHING;

INSERT INTO public.firewall_rules (rule_order, enabled, action, interface, direction, protocol, source_type, source_value, destination_type, destination_value, description, logging) VALUES
  (1, true, 'block', 'WAN', 'in', 'any', 'any', '*', 'any', '*', 'Block all inbound by default', true),
  (2, true, 'pass', 'WAN', 'in', 'tcp', 'any', '*', 'address', '203.113.152.45', 'Allow HTTPS to Web Server', true),
  (3, true, 'pass', 'LAN', 'out', 'any', 'network', '192.168.1.0/24', 'any', '*', 'Allow LAN to Internet', false),
  (4, true, 'block', 'LAN', 'out', 'tcp', 'network', '192.168.1.0/24', 'any', '*', 'Block SMTP from LAN', true),
  (5, true, 'pass', 'DMZ', 'in', 'tcp', 'network', '10.0.0.0/24', 'address', '192.168.1.10', 'Allow DMZ to DB Server', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.vpn_tunnels (name, type, status, remote_gateway, local_network, remote_network) VALUES
  ('Branch Office HCM', 'ipsec', 'connected', '113.161.72.50', '192.168.1.0/24', '192.168.2.0/24'),
  ('Remote Workers', 'wireguard', 'connected', 'Multiple', '192.168.1.0/24', '10.10.0.0/24'),
  ('Cloud Datacenter', 'openvpn', 'disconnected', '35.198.123.45', '192.168.1.0/24', '172.31.0.0/16')
ON CONFLICT DO NOTHING;

INSERT INTO public.system_settings (key, value, description, is_auditable) VALUES
  ('hostname', 'AEGIS-NGFW-500', 'System hostname', true),
  ('timezone', 'Asia/Ho_Chi_Minh', 'System timezone', true),
  ('dns_primary', '8.8.8.8', 'Primary DNS server', false),
  ('dns_secondary', '8.8.4.4', 'Secondary DNS server', false)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.static_routes (destination, gateway, interface, distance, priority, status, comment) VALUES
  ('0.0.0.0/0', '192.168.1.1', 'wan1', 10, 0, 'enabled', 'Default Gateway'),
  ('10.0.0.0/8', '192.168.100.1', 'internal', 10, 0, 'enabled', 'Internal Network'),
  ('172.16.0.0/12', '192.168.100.254', 'dmz', 10, 0, 'enabled', 'DMZ Route'),
  ('192.168.50.0/24', '192.168.1.254', 'wan2', 20, 5, 'disabled', 'Backup Route');

INSERT INTO public.policy_routes (seq, incoming, source, destination, protocol, gateway, out_interface, status, comment) VALUES
  (1, 'internal', '10.0.1.0/24', '0.0.0.0/0', 'any', '192.168.1.1', 'wan1', 'enabled', 'Force WAN1 for subnet'),
  (2, 'internal', '10.0.2.0/24', '0.0.0.0/0', 'any', '192.168.2.1', 'wan2', 'enabled', 'Force WAN2 for subnet');

INSERT INTO public.aliases (name, type, values, description, usage_count) VALUES
  ('LAN_NETWORK', 'network', ARRAY['192.168.1.0/24'], 'Internal LAN network segment', 12),
  ('DMZ_NETWORK', 'network', ARRAY['10.0.0.0/24'], 'DMZ network for public services', 8),
  ('WEB_SERVERS', 'host', ARRAY['192.168.1.10', '192.168.1.11', '192.168.1.12'], 'Production web server cluster', 5),
  ('MANAGEMENT_PORTS', 'port', ARRAY['22', '443', '8443'], 'Management access ports', 6);

INSERT INTO public.services (name, category, protocol, dest_ports, source_ports, comment, references_count, is_system) VALUES
  ('HTTP', 'Web Access', 'TCP', '80', '1-65535', 'Hypertext Transfer Protocol', 12, true),
  ('HTTPS', 'Web Access', 'TCP', '443', '1-65535', 'HTTP Secure', 15, true),
  ('SSH', 'Remote Access', 'TCP', '22', '1-65535', 'Secure Shell', 8, true),
  ('DNS', 'Network Services', 'TCP/UDP', '53', '1-65535', 'Domain Name System', 10, true),
  ('PING', 'Network Services', 'ICMP', '-', '-', 'ICMP Echo Request', 7, true);

INSERT INTO public.schedules (name, description, enabled, days, start_time, end_time, usage_count) VALUES
  ('business_hours', 'Standard business hours', true, ARRAY[1,2,3,4,5], '08:00', '18:00', 8),
  ('weekends', 'Weekend access', true, ARRAY[0,6], '00:00', '23:59', 2),
  ('always', 'Always active', true, ARRAY[0,1,2,3,4,5,6], '00:00', '23:59', 15);

INSERT INTO public.certificates (name, type, subject, issuer, serial_number, valid_from, valid_to, status, key_type, key_size, in_use, used_by, fingerprint) VALUES
  ('Aegis_Local_CA', 'ca', 'CN=Aegis Local CA, O=Aegis Security, C=VN', 'CN=Aegis Local CA, O=Aegis Security, C=VN', '01:23:45:67:89:AB:CD:EF', '2024-01-01', '2034-01-01', 'valid', 'RSA', 4096, true, ARRAY['SSL Inspection'], 'AB:CD:EF:12:34:56:78:90');

INSERT INTO public.ids_signatures (sid, name, category, severity, action, enabled, hits, description) VALUES
  (2001219, 'ET SCAN SSH Brute Force Attempt', 'Attempted Administrator', 'high', 'drop', true, 1250, 'Detects SSH brute force login attempts'),
  (2003068, 'ET MALWARE Trojan.GenericKD C2', 'Malware Command and Control', 'critical', 'drop', true, 85, 'Detects communication with known C2 servers'),
  (2019401, 'ET SQL Injection UNION SELECT', 'Web Application Attack', 'critical', 'drop', true, 156, 'Detects SQL injection attempts');

INSERT INTO public.dhcp_servers (interface, enabled, range_start, range_end, gateway, netmask, dns1, dns2, domain, lease_time, active_leases, total_pool) VALUES
  ('LAN', true, '192.168.1.100', '192.168.1.200', '192.168.1.1', '255.255.255.0', '8.8.8.8', '8.8.4.4', 'local.lan', 86400, 45, 101);

INSERT INTO public.dhcp_leases (ip, mac, hostname, status) VALUES
  ('192.168.1.100', '00:11:22:33:44:55', 'workstation-01', 'active'),
  ('192.168.1.101', '00:11:22:33:44:56', 'laptop-finance', 'active'),
  ('192.168.1.102', '00:11:22:33:44:57', 'printer-main', 'static');

INSERT INTO public.dns_forward_zones (name, type, servers, enabled) VALUES
  ('Default', 'forward', ARRAY['8.8.8.8', '8.8.4.4'], true);

INSERT INTO public.ip_pools (name, comments, type, start_ip, end_ip, associated_interface, enabled, used_ips, total_ips) VALUES
  ('SNAT-Pool-1', 'Primary outbound NAT pool', 'overload', '203.0.113.100', '203.0.113.110', 'wan1', true, 8, 11);

INSERT INTO public.virtual_ips (name, comments, type, external_ip, mapped_ip, interface, protocol, external_port, mapped_port, enabled, sessions) VALUES
  ('WebServer-VIP', 'Main web server virtual IP', 'static-nat', '203.0.113.10', '192.168.1.100', 'wan1', 'TCP', '443', '443', true, 1247);

INSERT INTO public.traffic_shapers (name, type, guaranteed_bandwidth, maximum_bandwidth, burst_bandwidth, priority, enabled, current_usage) VALUES
  ('high-priority', 'shared', 500, 1000, 1200, 'high', true, 456),
  ('medium-priority', 'shared', 200, 500, 600, 'medium', true, 312);

INSERT INTO public.av_profiles (name, comment, action, emulator_enabled) VALUES
  ('default', 'Default antivirus profile', 'block', true);

INSERT INTO public.web_filter_profiles (name, comment, mode, action) VALUES
  ('default', 'Default web filter', 'proxy', 'block');

INSERT INTO public.system_metrics (hostname, uptime, cpu_usage, cpu_cores, cpu_temperature, memory_total, memory_used, memory_free, memory_cached, disk_total, disk_used, disk_free, load_1m, load_5m, load_15m) VALUES
  ('AEGIS-NGFW-500', 2592000, 23, 8, 45, 32768, 12288, 16384, 4096, 512000, 128000, 384000, 1.25, 1.42, 1.38);

INSERT INTO public.ai_analysis (risk_score, anomalies_detected, threats_blocked, predictions, recommendations) VALUES
  (72, 15, 1247,
   '[{"id":"pred-1","type":"DDoS Attack","probability":35,"description":"Unusual traffic pattern detected"}]'::jsonb,
   '[{"id":"rec-1","priority":"high","category":"Security","title":"Enable GeoIP Blocking","description":"Block traffic from high-risk countries","action":"Configure GeoIP rules"}]'::jsonb);

-- ── Packet Captures ──
CREATE TABLE IF NOT EXISTS public.packet_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  interface TEXT NOT NULL DEFAULT 'any',
  filter TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'stopped' CHECK (status IN ('running', 'stopped', 'completed', 'error')),
  packets BIGINT NOT NULL DEFAULT 0,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  pcap_file TEXT,
  pid INT,
  max_packets INT DEFAULT 0,
  duration_seconds INT DEFAULT 0,
  started_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Network Topology (discovered devices) ──
CREATE TABLE IF NOT EXISTS public.network_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL,
  mac_address TEXT NOT NULL DEFAULT '',
  device_type TEXT NOT NULL DEFAULT 'unknown' CHECK (device_type IN ('firewall', 'switch', 'router', 'server', 'client', 'ap', 'printer', 'iot', 'unknown')),
  status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'offline', 'warning')),
  interface TEXT NOT NULL DEFAULT '',
  vlan TEXT,
  vendor TEXT,
  hostname TEXT,
  os_hint TEXT,
  open_ports INT[] DEFAULT '{}',
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_network_devices_ip ON public.network_devices(ip_address);

-- ── Firmware Info ──
CREATE TABLE IF NOT EXISTS public.firmware_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostname TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT 'Aegis-NGFW-500',
  serial_number TEXT NOT NULL DEFAULT '',
  current_version TEXT NOT NULL DEFAULT '',
  build_number TEXT NOT NULL DEFAULT '',
  kernel_version TEXT NOT NULL DEFAULT '',
  os_version TEXT NOT NULL DEFAULT '',
  uptime_seconds BIGINT NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── System Backups (config backups tracked by agent) ──
CREATE TABLE IF NOT EXISTS public.config_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  filepath TEXT NOT NULL DEFAULT '',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'manual' CHECK (type IN ('manual', 'auto', 'pre-upgrade', 'scheduled')),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'in_progress')),
  firmware_version TEXT NOT NULL DEFAULT '',
  sections TEXT[] DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_config_backups_created ON public.config_backups(created_at DESC);

-- Grant on new tables
GRANT ALL ON public.packet_captures TO authenticated;
GRANT SELECT ON public.packet_captures TO anon;
GRANT ALL ON public.network_devices TO authenticated;
GRANT SELECT ON public.network_devices TO anon;
GRANT ALL ON public.firmware_info TO authenticated;
GRANT SELECT ON public.firmware_info TO anon;
GRANT ALL ON public.config_backups TO authenticated;
GRANT SELECT ON public.config_backups TO anon;

-- Seed firmware info
INSERT INTO public.firmware_info (hostname, model, current_version, build_number, kernel_version, os_version) VALUES
  ('AEGIS-NGFW-500', 'Aegis-NGFW-500', '2.0.0', '2571', '', '')
ON CONFLICT DO NOTHING;
