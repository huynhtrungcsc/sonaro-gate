import { cn } from '@/lib/utils';
import { useVPN, useRecentThreats, useFirewallStats, useInterfaces } from '@/hooks/useDashboardData';

export function QuickStats() {
  const fwStats = useFirewallStats();
  const { data: vpnTunnels = [] } = useVPN();
  const { data: threats = [] } = useRecentThreats();
  const { data: ifaces = [] } = useInterfaces();

  const connectedVPNs = vpnTunnels.filter(v => v.status === 'connected').length;

  const stats = [
    {
      label: 'Firewall Rules',
      value: fwStats.data?.total ?? 0,
      subtext: `${fwStats.data?.active ?? 0} active`,
      trend: 'neutral' as const,
    },
    {
      label: 'Interfaces',
      value: ifaces.filter(i => i.status === 'up').length,
      subtext: `of ${ifaces.length} total`,
      trend: 'neutral' as const,
    },
    {
      label: 'VPN Tunnels',
      value: connectedVPNs,
      subtext: `of ${vpnTunnels.length} tunnels`,
      trend: connectedVPNs > 0 ? 'up' as const : 'neutral' as const,
    },
    {
      label: 'Threats (24h)',
      value: threats.length,
      subtext: `${threats.filter(t => t.severity === 'critical').length} critical`,
      trend: 'up' as const,
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="metric-card">
          <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{stat.value}</span>
            {stat.trend === 'up' && <span className="text-status-success text-xs">↑</span>}
            {(stat.trend as string) === 'down' && <span className="text-status-danger text-xs">↓</span>}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">{stat.subtext}</div>
        </div>
      ))}
    </div>
  );
}
