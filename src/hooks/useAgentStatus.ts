import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/postgrest';
import { useAuth } from '@/contexts/AuthContext';

export interface AgentStatus {
  connected: boolean;
  lastSyncTime: string | null;
  lastMetricTime: string | null;
  appliedRules: number;
  activeInterfaces: number;
  vpnTunnels: number;
  threatEventsToday: number;
  hostname: string;
  agentVersion: string;
}

export function useAgentStatus() {
  const { user } = useAuth();

  return useQuery<AgentStatus>({
    queryKey: ['agent-status', !!user],
    queryFn: async () => {
      const [metricsRes, rulesRes, ifacesRes, vpnRes, threatsRes] = await Promise.all([
        db.from('system_metrics').select('recorded_at,hostname').order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
        db.from('firewall_rules').select('id').eq('enabled', true),
        db.from('network_interfaces').select('id').eq('status', 'up'),
        db.from('vpn_tunnels').select('id').eq('status', 'connected'),
        db.from('threat_events').select('id').gte('created_at', new Date(Date.now() - 86400000).toISOString()),
      ]);

      const lastMetric = metricsRes.data;
      const isConnected = lastMetric && (Date.now() - new Date(lastMetric.recorded_at).getTime()) < 120000;

      return {
        connected: !!isConnected,
        lastSyncTime: lastMetric?.recorded_at ?? null,
        lastMetricTime: lastMetric?.recorded_at ?? null,
        appliedRules: rulesRes.data?.length ?? 0,
        activeInterfaces: ifacesRes.data?.length ?? 0,
        vpnTunnels: vpnRes.data?.length ?? 0,
        threatEventsToday: threatsRes.data?.length ?? 0,
        hostname: lastMetric?.hostname ?? 'unknown',
        agentVersion: '1.0.0',
      };
    },
    enabled: !!user,
    refetchInterval: 10000,
  });
}
