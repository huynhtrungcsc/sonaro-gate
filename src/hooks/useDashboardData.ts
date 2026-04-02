import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/postgrest';

// Polling is a safety fallback only — real-time data arrives via WebSocket (useRealtimeMetrics).
const FALLBACK_INTERVAL = 120_000; // 2 minutes

export function useLatestMetrics() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['latest-metrics', !!user],
    queryFn: async () => {
      const { data, error } = await db
        .from('system_metrics')
        .select('*').order('recorded_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchInterval: FALLBACK_INTERVAL,
  });
}

export function useTrafficHistory(hours = 24) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['traffic-history', !!user, hours],
    queryFn: async () => {
      const since = new Date(Date.now() - hours * 3600000).toISOString();
      const { data, error } = await db
        .from('traffic_stats')
        .select('*').gte('recorded_at', since).order('recorded_at');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
    refetchInterval: FALLBACK_INTERVAL,
  });
}

export function useInterfaces() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['dashboard-interfaces', !!user],
    queryFn: async () => {
      const { data, error } = await db
        .from('network_interfaces')
        .select('*').order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
    refetchInterval: FALLBACK_INTERVAL,
  });
}

export function useVPN() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['dashboard-vpn', !!user],
    queryFn: async () => {
      const { data, error } = await db
        .from('vpn_tunnels')
        .select('*').order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
    refetchInterval: FALLBACK_INTERVAL,
  });
}

export function useRecentThreats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['dashboard-threats', !!user],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 3600000).toISOString();
      const { data, error } = await db
        .from('threat_events')
        .select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
    refetchInterval: FALLBACK_INTERVAL,
  });
}

export function useFirewallStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['dashboard-fw-stats', !!user],
    queryFn: async () => {
      const { data, error } = await db.from('firewall_rules').select('enabled');
      if (error) throw error;
      const rules = data ?? [];
      return { total: rules.length, active: rules.filter((r: any) => r.enabled).length };
    },
    enabled: !!user,
  });
}
