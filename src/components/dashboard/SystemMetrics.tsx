import { useLatestMetrics } from '@/hooks/useDashboardData';
import { cn } from '@/lib/utils';

export function SystemMetrics() {
  const { data: m } = useLatestMetrics();
  
  const cpuUsage = m?.cpu_usage ?? 0;
  const memoryPercent = m ? Math.round((m.memory_used / m.memory_total) * 100) : 0;
  const diskPercent = m ? Math.round((m.disk_used / m.disk_total) * 100) : 0;

  const metrics = [
    { 
      label: 'CPU Usage', 
      value: cpuUsage, 
      unit: '%', 
      subtext: m ? `${m.cpu_cores} Cores • ${m.cpu_temperature}°C` : '—',
      color: cpuUsage > 80 ? 'var(--status-danger)' : cpuUsage > 60 ? 'var(--status-warning)' : 'var(--status-success)'
    },
    { 
      label: 'Memory', 
      value: memoryPercent, 
      unit: '%', 
      subtext: m ? `${(m.memory_used / 1024).toFixed(1)} / ${(m.memory_total / 1024).toFixed(1)} GB` : '—',
      color: memoryPercent > 80 ? 'var(--status-danger)' : memoryPercent > 60 ? 'var(--status-warning)' : 'var(--status-success)'
    },
    { 
      label: 'Disk', 
      value: diskPercent, 
      unit: '%', 
      subtext: m ? `${(m.disk_used / 1024).toFixed(0)} / ${(m.disk_total / 1024).toFixed(0)} GB` : '—',
      color: diskPercent > 80 ? 'var(--status-danger)' : diskPercent > 60 ? 'var(--status-warning)' : 'var(--status-success)'
    },
  ];

  return (
    <div className="panel">
      <div className="panel-header">
        <h3 className="text-sm font-medium">System Resources</h3>
      </div>
      <div className="panel-body space-y-4">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-xs text-muted-foreground">{metric.label}</span>
              <span className="text-sm font-medium font-mono">{metric.value}{metric.unit}</span>
            </div>
            <div className="traffic-bar">
              <div 
                className="traffic-bar-fill" 
                style={{ 
                  width: `${metric.value}%`,
                  backgroundColor: `hsl(${metric.color})`
                }} 
              />
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">{metric.subtext}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
