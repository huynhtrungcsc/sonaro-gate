import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/postgrest';

function useDbQuery<T = any>(
  key: string,
  tableName: string,
  orderBy = 'created_at',
  options?: { ascending?: boolean; limit?: number }
) {
  const { user } = useAuth();

  return useQuery<T[]>({
    queryKey: [key, !!user],
    queryFn: async () => {
      const { data, error } = await db
        .from(tableName)
        .select('*')
        .order(orderBy, { ascending: options?.ascending ?? true })
        .limit(options?.limit ?? 1000);
      if (error) throw error;
      return (data as T[]) ?? [];
    },
    enabled: !!user,
  });
}

export function useFirewallRules() {
  return useDbQuery('firewall-rules', 'firewall_rules', 'rule_order');
}

export function useNATRules() {
  return useDbQuery('nat-rules', 'nat_rules', 'created_at');
}

export function useNetworkInterfaces() {
  return useDbQuery('network-interfaces', 'network_interfaces', 'name');
}

export function useVPNTunnels() {
  return useDbQuery('vpn-tunnels', 'vpn_tunnels', 'name');
}

export function useThreatEvents(limit = 100) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['threat-events', !!user, limit],
    queryFn: async () => {
      const { data, error } = await db
        .from('threat_events')
        .select('*').order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}

export function useSystemSettings() {
  return useDbQuery('system-settings', 'system_settings', 'key');
}

export function useStaticRoutes() {
  return useDbQuery('static-routes', 'static_routes');
}

export function usePolicyRoutes() {
  return useDbQuery('policy-routes', 'policy_routes', 'seq');
}

export function useAliases() {
  return useDbQuery('aliases', 'aliases', 'name');
}

export function useServices() {
  return useDbQuery('services', 'services', 'name');
}

export function useSchedules() {
  return useDbQuery('schedules', 'schedules', 'name');
}

export function useIPPools() {
  return useDbQuery('ip-pools', 'ip_pools', 'name');
}

export function useVirtualIPs() {
  return useDbQuery('virtual-ips', 'virtual_ips', 'name');
}

export function useWildcardFQDNs() {
  return useDbQuery('wildcard-fqdns', 'wildcard_fqdns', 'name');
}

export function useCertificates() {
  return useDbQuery('certificates', 'certificates', 'name');
}

export function useIDSSignatures() {
  return useDbQuery('ids-signatures', 'ids_signatures', 'sid');
}

export function useDNSFilterProfiles() {
  return useDbQuery('dns-filter-profiles', 'dns_filter_profiles', 'name');
}

export function useDHCPServers() {
  return useDbQuery('dhcp-servers', 'dhcp_servers', 'interface');
}

export function useDHCPLeases() {
  return useDbQuery('dhcp-leases', 'dhcp_leases', 'ip');
}

export function useDHCPStaticMappings() {
  return useDbQuery('dhcp-static-mappings', 'dhcp_static_mappings', 'name');
}

export function useDNSForwardZones() {
  return useDbQuery('dns-forward-zones', 'dns_forward_zones', 'name');
}

export function useDNSLocalRecords() {
  return useDbQuery('dns-local-records', 'dns_local_records', 'hostname');
}

export function useTrafficShapers() {
  return useDbQuery('traffic-shapers', 'traffic_shapers', 'name');
}

export function useTrafficShapingPolicies() {
  return useDbQuery('traffic-shaping-policies', 'traffic_shaping_policies', 'name');
}

export function useSystemMetrics(count = 1) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['system-metrics', !!user, count],
    queryFn: async () => {
      const { data, error } = await db
        .from('system_metrics')
        .select('*').order('recorded_at', { ascending: false }).limit(count);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });
}

export function useTrafficStats(hours = 24) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['traffic-stats', !!user, hours],
    queryFn: async () => {
      const since = new Date(Date.now() - hours * 3600000).toISOString();
      const { data, error } = await db
        .from('traffic_stats')
        .select('*').gte('recorded_at', since).order('recorded_at');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
    refetchInterval: 60000,
  });
}

export function useAuditLogs(limit = 200) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['audit-logs', !!user, limit],
    queryFn: async () => {
      const { data, error } = await db
        .from('audit_logs')
        .select('*').order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}
