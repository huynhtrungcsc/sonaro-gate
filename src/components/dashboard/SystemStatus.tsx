import { useLatestMetrics, useVPN } from '@/hooks/useDashboardData';
import { cn } from '@/lib/utils';

export function SystemStatus() {
  const { data: m } = useLatestMetrics();
  const { data: vpnTunnels = [] } = useVPN();
  
  const cpuUsage = m?.cpu_usage ?? 0;
  const memPercent = m ? Math.round((m.memory_used / m.memory_total) * 100) : 0;
  const connectedVPNs = vpnTunnels.filter(v => v.status === 'connected').length;

  const metrics = [
    { 
      label: 'CPU', value: cpuUsage, suffix: '%',
      status: cpuUsage > 80 ? 'critical' : cpuUsage > 60 ? 'medium' : 'healthy'
    },
    { 
      label: 'Memory', value: memPercent, suffix: '%',
      status: memPercent > 80 ? 'critical' : memPercent > 60 ? 'medium' : 'healthy'
    },
    { 
      label: 'Sessions', value: '12.8K', suffix: '',
      status: 'healthy'
    },
    { 
      label: 'VPN', value: connectedVPNs, suffix: `/${vpnTunnels.length}`,
      status: connectedVPNs === vpnTunnels.length ? 'healthy' : connectedVPNs > 0 ? 'medium' : 'inactive'
    },
  ];

  return (
    <div className="panel h-full">
      <div className="panel-header"><span>System Status</span></div>
      <div className="panel-body">
        <div className="grid grid-cols-2 gap-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="space-y-1">
              <div className="text-xs text-muted-foreground">{metric.label}</div>
              <div className="flex items-baseline gap-1">
                <span className={cn(
                  "text-xl font-semibold",
                  metric.status === 'critical' ? 'text-status-critical' :
                  metric.status === 'medium' ? 'text-status-medium' :
                  metric.status === 'healthy' ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {metric.value}
                </span>
                <span className="text-sm text-muted-foreground">{metric.suffix}</span>
              </div>
              {typeof metric.value === 'number' && (
                <div className="h-1 bg-border rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all",
                      metric.status === 'critical' ? 'bg-status-critical' :
                      metric.status === 'medium' ? 'bg-status-medium' : 'bg-status-healthy'
                    )}
                    style={{ width: `${metric.value}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
