import { db, isApiConfigured } from '@/lib/postgrest';

// ─── Types (standalone, no Supabase dependency) ─
export interface FirewallRule {
  id: string; rule_order: number; enabled: boolean; action: string; interface: string;
  direction: string; protocol: string; source_type: string; source_value: string;
  source_port: string | null; destination_type: string; destination_value: string;
  destination_port: string | null; description: string; logging: boolean;
  hits: number; last_hit: string | null; created_at: string; updated_at: string;
  created_by: string | null;
}
export interface NATRule {
  id: string; type: string; enabled: boolean; interface: string; protocol: string;
  external_address: string | null; external_port: string; internal_address: string;
  internal_port: string; description: string; created_at: string; updated_at: string;
  created_by: string | null;
}
export interface NetworkInterface {
  id: string; name: string; type: string; status: string; ip_address: string | null;
  subnet: string | null; gateway: string | null; mac: string | null; speed: string | null;
  duplex: string | null; mtu: number | null; vlan: number | null;
  rx_bytes: number | null; tx_bytes: number | null; rx_packets: number | null;
  tx_packets: number | null; created_at: string; updated_at: string;
}
export interface VPNTunnel {
  id: string; name: string; type: string; status: string; remote_gateway: string | null;
  local_network: string | null; remote_network: string | null;
  bytes_in: number | null; bytes_out: number | null; uptime: number | null;
  created_at: string; updated_at: string;
}
export interface ThreatEvent {
  id: string; severity: string; category: string; source_ip: string | null;
  destination_ip: string | null; source_port: number | null; destination_port: number | null;
  protocol: string | null; signature: string | null; description: string | null;
  action: string; ai_confidence: number | null; created_at: string;
}
export interface SystemSetting {
  id: string; key: string; value: string; description: string | null;
  is_auditable: boolean; created_at: string; updated_at: string;
}
export interface SystemMetric {
  id: string; hostname: string; uptime: number; cpu_usage: number; cpu_cores: number;
  cpu_temperature: number; memory_total: number; memory_used: number; memory_free: number;
  memory_cached: number; disk_total: number; disk_used: number; disk_free: number;
  load_1m: number; load_5m: number; load_15m: number; recorded_at: string;
}
export interface TrafficStat {
  id: string; interface: string; inbound: number; outbound: number; blocked: number;
  recorded_at: string;
}
// ─── Generic CRUD helper ─────────────────────────
function createCrudApi<T = any>(tableName: string, orderBy = 'created_at') {
  return {
    async getAll(): Promise<T[]> {
      if (!isApiConfigured()) return [];
      const result = await db.from<T>(tableName).select('*').order(orderBy, { ascending: true });
      const { data, error } = await (result as any);
      if (error) throw error;
      return (data as T[]) ?? [];
    },
    async create(record: Partial<T>): Promise<T> {
      const builder = db.from<T>(tableName);
      (builder as any).insert(record);
      const { data, error } = await (builder.single() as any);
      if (error) throw error;
      return data as T;
    },
    async update(id: string, updates: Partial<T>): Promise<T> {
      const builder = db.from<T>(tableName);
      (builder as any).update(updates);
      const { data, error } = await (builder.eq('id', id).single() as any);
      if (error) throw error;
      return data as T;
    },
    async delete(id: string): Promise<void> {
      const builder = db.from(tableName);
      (builder as any).delete();
      const { error } = await (builder.eq('id', id) as any);
      if (error) throw error;
    },
    async deleteMany(ids: string[]): Promise<void> {
      const builder = db.from(tableName);
      (builder as any).delete();
      const { error } = await (builder.in('id', ids) as any);
      if (error) throw error;
    },
  };
}

// ─── API exports ─────────────────────────────────
export const firewallRulesApi = {
  ...createCrudApi<FirewallRule>('firewall_rules', 'rule_order'),
};
export const natRulesApi = createCrudApi<NATRule>('nat_rules');
export const networkInterfacesApi = createCrudApi<NetworkInterface>('network_interfaces', 'name');
export const vpnTunnelsApi = createCrudApi<VPNTunnel>('vpn_tunnels', 'name');
export const systemSettingsApi = {
  async getAll() {
    if (!isApiConfigured()) return [];
    const { data, error } = await (db.from('system_settings').select('*').order('key') as any);
    if (error) throw error;
    return data ?? [];
  },
  async get(key: string) {
    if (!isApiConfigured()) return null;
    const { data, error } = await (db.from('system_settings').eq('key', key).maybeSingle() as any);
    if (error) throw error;
    return data;
  },
  async upsert(key: string, value: string, description?: string) {
    const builder = db.from('system_settings');
    (builder as any).upsert({ key, value, description }, { onConflict: 'key' });
    const { data, error } = await (builder.single() as any);
    if (error) throw error;
    return data;
  },
};
export const threatEventsApi = {
  async getAll(limit = 100) {
    if (!isApiConfigured()) return [];
    const { data, error } = await (db.from<ThreatEvent>('threat_events').select('*').order('created_at', { ascending: false }).limit(limit) as any);
    if (error) throw error;
    return data ?? [];
  },
  async getById(id: string) {
    if (!isApiConfigured()) return null;
    const { data, error } = await (db.from<ThreatEvent>('threat_events').eq('id', id).maybeSingle() as any);
    if (error) throw error;
    return data;
  },
};
export const staticRoutesApi = createCrudApi('static_routes');
export const policyRoutesApi = createCrudApi('policy_routes', 'seq');
export const aliasesApi = createCrudApi('aliases', 'name');
export const servicesApi = createCrudApi('services', 'name');
export const schedulesApi = createCrudApi('schedules', 'name');
export const certificatesApi = createCrudApi('certificates', 'name');
export const idsSignaturesApi = createCrudApi('ids_signatures', 'sid');
export const dhcpServersApi = createCrudApi('dhcp_servers', 'interface');
export const dhcpStaticMappingsApi = createCrudApi('dhcp_static_mappings', 'name');
export const dhcpLeasesApi = createCrudApi('dhcp_leases', 'ip');
export const dnsFilterProfilesApi = createCrudApi('dns_filter_profiles', 'name');
export const dnsForwardZonesApi = createCrudApi('dns_forward_zones', 'name');
export const dnsLocalRecordsApi = createCrudApi('dns_local_records', 'hostname');
export const ipPoolsApi = createCrudApi('ip_pools', 'name');
export const virtualIpsApi = createCrudApi('virtual_ips', 'name');
export const wildcardFqdnsApi = createCrudApi('wildcard_fqdns', 'name');
export const trafficShapersApi = createCrudApi('traffic_shapers', 'name');
export const trafficShapingPoliciesApi = createCrudApi('traffic_shaping_policies', 'name');
export const auditLogsApi = {
  async getAll(limit = 200) {
    if (!isApiConfigured()) return [];
    const { data, error } = await (db.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit) as any);
    if (error) throw error;
    return data ?? [];
  },
  async create(log: any) {
    const builder = db.from('audit_logs');
    (builder as any).insert(log);
    const { data, error } = await (builder.single() as any);
    if (error) throw error;
    return data;
  },
};
export const trafficStatsApi = {
  async getRecent(hours = 24) {
    if (!isApiConfigured()) return [];
    const since = new Date(Date.now() - hours * 3600000).toISOString();
    const { data, error } = await (db.from<TrafficStat>('traffic_stats').select('*').gte('recorded_at', since).order('recorded_at') as any);
    if (error) throw error;
    return data ?? [];
  },
};
export const systemMetricsApi = {
  async getLatest(): Promise<SystemMetric | null> {
    if (!isApiConfigured()) return null;
    const { data, error } = await (db.from<SystemMetric>('system_metrics').select('*').order('recorded_at', { ascending: false }).limit(1).maybeSingle() as any);
    if (error) throw error;
    return data;
  },
  async getRecent(count = 60) {
    if (!isApiConfigured()) return [];
    const { data, error } = await (db.from<SystemMetric>('system_metrics').select('*').order('recorded_at', { ascending: false }).limit(count) as any);
    if (error) throw error;
    return data ?? [];
  },
};
export const profilesApi = {
  async getAll() {
    if (!isApiConfigured()) return [];
    const { data, error } = await (db.from('users').select('*').order('full_name') as any);
    if (error) throw error;
    return data ?? [];
  },
};
