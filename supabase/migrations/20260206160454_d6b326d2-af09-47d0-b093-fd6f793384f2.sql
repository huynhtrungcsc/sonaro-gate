
-- ============================================
-- Aegis NGFW - Full Schema Migration
-- All missing tables for complete backend coverage
-- ============================================

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
ALTER TABLE public.static_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator+ can read static_routes" ON public.static_routes FOR SELECT USING (is_operator_or_higher(auth.uid()));
CREATE POLICY "Admin+ can insert static_routes" ON public.static_routes FOR INSERT WITH CHECK (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update static_routes" ON public.static_routes FOR UPDATE USING (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete static_routes" ON public.static_routes FOR DELETE USING (is_admin_or_super_admin(auth.uid()));

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
ALTER TABLE public.policy_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator+ can read policy_routes" ON public.policy_routes FOR SELECT USING (is_operator_or_higher(auth.uid()));
CREATE POLICY "Admin+ can insert policy_routes" ON public.policy_routes FOR INSERT WITH CHECK (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update policy_routes" ON public.policy_routes FOR UPDATE USING (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete policy_routes" ON public.policy_routes FOR DELETE USING (is_admin_or_super_admin(auth.uid()));

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
ALTER TABLE public.aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator+ can read aliases" ON public.aliases FOR SELECT USING (is_operator_or_higher(auth.uid()));
CREATE POLICY "Admin+ can insert aliases" ON public.aliases FOR INSERT WITH CHECK (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update aliases" ON public.aliases FOR UPDATE USING (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete aliases" ON public.aliases FOR DELETE USING (is_admin_or_super_admin(auth.uid()));

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
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator+ can read services" ON public.services FOR SELECT USING (is_operator_or_higher(auth.uid()));
CREATE POLICY "Admin+ can insert services" ON public.services FOR INSERT WITH CHECK (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update services" ON public.services FOR UPDATE USING (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete services" ON public.services FOR DELETE USING (is_admin_or_super_admin(auth.uid()));

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
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator+ can read schedules" ON public.schedules FOR SELECT USING (is_operator_or_higher(auth.uid()));
CREATE POLICY "Admin+ can insert schedules" ON public.schedules FOR INSERT WITH CHECK (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update schedules" ON public.schedules FOR UPDATE USING (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete schedules" ON public.schedules FOR DELETE USING (is_admin_or_super_admin(auth.uid()));

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
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator+ can read certificates" ON public.certificates FOR SELECT USING (is_operator_or_higher(auth.uid()));
CREATE POLICY "Admin+ can insert certificates" ON public.certificates FOR INSERT WITH CHECK (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update certificates" ON public.certificates FOR UPDATE USING (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete certificates" ON public.certificates FOR DELETE USING (is_admin_or_super_admin(auth.uid()));

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
ALTER TABLE public.ids_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator+ can read ids_signatures" ON public.ids_signatures FOR SELECT USING (is_operator_or_higher(auth.uid()));
CREATE POLICY "Admin+ can insert ids_signatures" ON public.ids_signatures FOR INSERT WITH CHECK (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update ids_signatures" ON public.ids_signatures FOR UPDATE USING (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete ids_signatures" ON public.ids_signatures FOR DELETE USING (is_admin_or_super_admin(auth.uid()));

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
ALTER TABLE public.dhcp_servers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator+ can read dhcp_servers" ON public.dhcp_servers FOR SELECT USING (is_operator_or_higher(auth.uid()));
CREATE POLICY "Admin+ can insert dhcp_servers" ON public.dhcp_servers FOR INSERT WITH CHECK (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update dhcp_servers" ON public.dhcp_servers FOR UPDATE USING (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete dhcp_servers" ON public.dhcp_servers FOR DELETE USING (is_admin_or_super_admin(auth.uid()));

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
ALTER TABLE public.dhcp_static_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator+ can read dhcp_static_mappings" ON public.dhcp_static_mappings FOR SELECT USING (is_operator_or_higher(auth.uid()));
CREATE POLICY "Admin+ can insert dhcp_static_mappings" ON public.dhcp_static_mappings FOR INSERT WITH CHECK (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update dhcp_static_mappings" ON public.dhcp_static_mappings FOR UPDATE USING (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete dhcp_static_mappings" ON public.dhcp_static_mappings FOR DELETE USING (is_admin_or_super_admin(auth.uid()));

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
ALTER TABLE public.dhcp_leases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator+ can read dhcp_leases" ON public.dhcp_leases FOR SELECT USING (is_operator_or_higher(auth.uid()));
CREATE POLICY "Admin+ can insert dhcp_leases" ON public.dhcp_leases FOR INSERT WITH CHECK (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update dhcp_leases" ON public.dhcp_leases FOR UPDATE USING (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete dhcp_leases" ON public.dhcp_leases FOR DELETE USING (is_admin_or_super_admin(auth.uid()));

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
ALTER TABLE public.dns_filter_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator+ can read dns_filter_profiles" ON public.dns_filter_profiles FOR SELECT USING (is_operator_or_higher(auth.uid()));
CREATE POLICY "Admin+ can insert dns_filter_profiles" ON public.dns_filter_profiles FOR INSERT WITH CHECK (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update dns_filter_profiles" ON public.dns_filter_profiles FOR UPDATE USING (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete dns_filter_profiles" ON public.dns_filter_profiles FOR DELETE USING (is_admin_or_super_admin(auth.uid()));

-- ── DNS Server Forward Zones ──
CREATE TABLE IF NOT EXISTS public.dns_forward_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'forward',
  servers TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dns_forward_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator+ can read dns_forward_zones" ON public.dns_forward_zones FOR SELECT USING (is_operator_or_higher(auth.uid()));
CREATE POLICY "Admin+ can insert dns_forward_zones" ON public.dns_forward_zones FOR INSERT WITH CHECK (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update dns_forward_zones" ON public.dns_forward_zones FOR UPDATE USING (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete dns_forward_zones" ON public.dns_forward_zones FOR DELETE USING (is_admin_or_super_admin(auth.uid()));

-- ── DNS Server Local Records ──
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
ALTER TABLE public.dns_local_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator+ can read dns_local_records" ON public.dns_local_records FOR SELECT USING (is_operator_or_higher(auth.uid()));
CREATE POLICY "Admin+ can insert dns_local_records" ON public.dns_local_records FOR INSERT WITH CHECK (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update dns_local_records" ON public.dns_local_records FOR UPDATE USING (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete dns_local_records" ON public.dns_local_records FOR DELETE USING (is_admin_or_super_admin(auth.uid()));

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
ALTER TABLE public.ip_pools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator+ can read ip_pools" ON public.ip_pools FOR SELECT USING (is_operator_or_higher(auth.uid()));
CREATE POLICY "Admin+ can insert ip_pools" ON public.ip_pools FOR INSERT WITH CHECK (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update ip_pools" ON public.ip_pools FOR UPDATE USING (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete ip_pools" ON public.ip_pools FOR DELETE USING (is_admin_or_super_admin(auth.uid()));

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
ALTER TABLE public.virtual_ips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator+ can read virtual_ips" ON public.virtual_ips FOR SELECT USING (is_operator_or_higher(auth.uid()));
CREATE POLICY "Admin+ can insert virtual_ips" ON public.virtual_ips FOR INSERT WITH CHECK (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update virtual_ips" ON public.virtual_ips FOR UPDATE USING (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete virtual_ips" ON public.virtual_ips FOR DELETE USING (is_admin_or_super_admin(auth.uid()));

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
ALTER TABLE public.wildcard_fqdns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator+ can read wildcard_fqdns" ON public.wildcard_fqdns FOR SELECT USING (is_operator_or_higher(auth.uid()));
CREATE POLICY "Admin+ can insert wildcard_fqdns" ON public.wildcard_fqdns FOR INSERT WITH CHECK (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update wildcard_fqdns" ON public.wildcard_fqdns FOR UPDATE USING (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete wildcard_fqdns" ON public.wildcard_fqdns FOR DELETE USING (is_admin_or_super_admin(auth.uid()));

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
ALTER TABLE public.traffic_shapers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator+ can read traffic_shapers" ON public.traffic_shapers FOR SELECT USING (is_operator_or_higher(auth.uid()));
CREATE POLICY "Admin+ can insert traffic_shapers" ON public.traffic_shapers FOR INSERT WITH CHECK (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update traffic_shapers" ON public.traffic_shapers FOR UPDATE USING (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete traffic_shapers" ON public.traffic_shapers FOR DELETE USING (is_admin_or_super_admin(auth.uid()));

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
ALTER TABLE public.traffic_shaping_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator+ can read traffic_shaping_policies" ON public.traffic_shaping_policies FOR SELECT USING (is_operator_or_higher(auth.uid()));
CREATE POLICY "Admin+ can insert traffic_shaping_policies" ON public.traffic_shaping_policies FOR INSERT WITH CHECK (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update traffic_shaping_policies" ON public.traffic_shaping_policies FOR UPDATE USING (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete traffic_shaping_policies" ON public.traffic_shaping_policies FOR DELETE USING (is_admin_or_super_admin(auth.uid()));

-- ── SSL Inspection Profiles ──
CREATE TABLE IF NOT EXISTS public.ssl_inspection_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  inspection_mode TEXT NOT NULL DEFAULT 'certificate-inspection' CHECK (inspection_mode IN ('certificate-inspection', 'deep-inspection')),
  https_enabled BOOLEAN NOT NULL DEFAULT true,
  smtps_enabled BOOLEAN NOT NULL DEFAULT false,
  pop3s_enabled BOOLEAN NOT NULL DEFAULT false,
  imaps_enabled BOOLEAN NOT NULL DEFAULT false,
  ftps_enabled BOOLEAN NOT NULL DEFAULT false,
  ca_certificate TEXT NOT NULL DEFAULT '',
  untrusted_cert_action TEXT NOT NULL DEFAULT 'allow' CHECK (untrusted_cert_action IN ('allow', 'block', 'ignore')),
  expired_cert_action TEXT NOT NULL DEFAULT 'allow' CHECK (expired_cert_action IN ('allow', 'block', 'ignore')),
  references_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ssl_inspection_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator+ can read ssl_inspection_profiles" ON public.ssl_inspection_profiles FOR SELECT USING (is_operator_or_higher(auth.uid()));
CREATE POLICY "Admin+ can insert ssl_inspection_profiles" ON public.ssl_inspection_profiles FOR INSERT WITH CHECK (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update ssl_inspection_profiles" ON public.ssl_inspection_profiles FOR UPDATE USING (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete ssl_inspection_profiles" ON public.ssl_inspection_profiles FOR DELETE USING (is_admin_or_super_admin(auth.uid()));

-- ── Security Profiles - AntiVirus ──
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
ALTER TABLE public.av_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator+ can read av_profiles" ON public.av_profiles FOR SELECT USING (is_operator_or_higher(auth.uid()));
CREATE POLICY "Admin+ can insert av_profiles" ON public.av_profiles FOR INSERT WITH CHECK (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update av_profiles" ON public.av_profiles FOR UPDATE USING (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete av_profiles" ON public.av_profiles FOR DELETE USING (is_admin_or_super_admin(auth.uid()));

-- ── Security Profiles - Web Filter ──
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
ALTER TABLE public.web_filter_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator+ can read web_filter_profiles" ON public.web_filter_profiles FOR SELECT USING (is_operator_or_higher(auth.uid()));
CREATE POLICY "Admin+ can insert web_filter_profiles" ON public.web_filter_profiles FOR INSERT WITH CHECK (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update web_filter_profiles" ON public.web_filter_profiles FOR UPDATE USING (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete web_filter_profiles" ON public.web_filter_profiles FOR DELETE USING (is_admin_or_super_admin(auth.uid()));

-- ── Traffic Stats (time-series for dashboard graph) ──
CREATE TABLE IF NOT EXISTS public.traffic_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interface TEXT NOT NULL DEFAULT 'WAN',
  inbound INT NOT NULL DEFAULT 0,
  outbound INT NOT NULL DEFAULT 0,
  blocked INT NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.traffic_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Any role can read traffic_stats" ON public.traffic_stats FOR SELECT USING (is_any_role(auth.uid()));
CREATE POLICY "Admin+ can insert traffic_stats" ON public.traffic_stats FOR INSERT WITH CHECK (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete traffic_stats" ON public.traffic_stats FOR DELETE USING (is_admin_or_super_admin(auth.uid()));
CREATE INDEX idx_traffic_stats_recorded_at ON public.traffic_stats(recorded_at DESC);

-- ── System Metrics (periodic snapshots for CPU/RAM/Disk) ──
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
ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Any role can read system_metrics" ON public.system_metrics FOR SELECT USING (is_any_role(auth.uid()));
CREATE POLICY "Admin+ can insert system_metrics" ON public.system_metrics FOR INSERT WITH CHECK (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete system_metrics" ON public.system_metrics FOR DELETE USING (is_admin_or_super_admin(auth.uid()));
CREATE INDEX idx_system_metrics_recorded_at ON public.system_metrics(recorded_at DESC);

-- ── AI Analysis (snapshot for dashboard) ──
CREATE TABLE IF NOT EXISTS public.ai_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_score INT NOT NULL DEFAULT 0,
  anomalies_detected INT NOT NULL DEFAULT 0,
  threats_blocked INT NOT NULL DEFAULT 0,
  predictions JSONB NOT NULL DEFAULT '[]',
  recommendations JSONB NOT NULL DEFAULT '[]',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Any role can read ai_analysis" ON public.ai_analysis FOR SELECT USING (is_any_role(auth.uid()));
CREATE POLICY "Admin+ can insert ai_analysis" ON public.ai_analysis FOR INSERT WITH CHECK (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can update ai_analysis" ON public.ai_analysis FOR UPDATE USING (is_admin_or_super_admin(auth.uid()));
CREATE POLICY "Admin+ can delete ai_analysis" ON public.ai_analysis FOR DELETE USING (is_admin_or_super_admin(auth.uid()));

-- ── Audit Logs ──
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT '',
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Any role can read audit_logs" ON public.audit_logs FOR SELECT USING (is_any_role(auth.uid()));
CREATE POLICY "System can insert audit_logs" ON public.audit_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Super admin can delete audit_logs" ON public.audit_logs FOR DELETE USING (has_role(auth.uid(), 'super_admin'));

-- ── Apply updated_at triggers to all new tables ──
CREATE TRIGGER update_static_routes_updated_at BEFORE UPDATE ON public.static_routes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_policy_routes_updated_at BEFORE UPDATE ON public.policy_routes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_aliases_updated_at BEFORE UPDATE ON public.aliases FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_certificates_updated_at BEFORE UPDATE ON public.certificates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_ids_signatures_updated_at BEFORE UPDATE ON public.ids_signatures FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_dhcp_servers_updated_at BEFORE UPDATE ON public.dhcp_servers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_dhcp_static_mappings_updated_at BEFORE UPDATE ON public.dhcp_static_mappings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_dns_filter_profiles_updated_at BEFORE UPDATE ON public.dns_filter_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_dns_forward_zones_updated_at BEFORE UPDATE ON public.dns_forward_zones FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_dns_local_records_updated_at BEFORE UPDATE ON public.dns_local_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_ip_pools_updated_at BEFORE UPDATE ON public.ip_pools FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_virtual_ips_updated_at BEFORE UPDATE ON public.virtual_ips FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_wildcard_fqdns_updated_at BEFORE UPDATE ON public.wildcard_fqdns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_traffic_shapers_updated_at BEFORE UPDATE ON public.traffic_shapers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_traffic_shaping_policies_updated_at BEFORE UPDATE ON public.traffic_shaping_policies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_ssl_inspection_profiles_updated_at BEFORE UPDATE ON public.ssl_inspection_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_av_profiles_updated_at BEFORE UPDATE ON public.av_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_web_filter_profiles_updated_at BEFORE UPDATE ON public.web_filter_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_ai_analysis_updated_at BEFORE UPDATE ON public.ai_analysis FOR EACH ROW EXECUTE FUNCTION update_updated_at();
