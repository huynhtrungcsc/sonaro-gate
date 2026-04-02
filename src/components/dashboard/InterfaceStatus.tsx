import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useInterfaces } from '@/hooks/useDashboardData';
import { formatBytes } from '@/lib/formatters';

export function InterfaceStatus() {
  const { data: ifaces = [] } = useInterfaces();

  return (
    <div className="panel">
      <div className="panel-header">
        <h3 className="text-sm font-medium">Network Interfaces</h3>
        <span className="text-xs text-muted-foreground">{ifaces.length} interfaces</span>
      </div>
      <div className="divide-y divide-border">
        {ifaces.map((iface) => (
          <div key={iface.id} className="p-4 hover:bg-secondary/30 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "status-dot",
                  iface.status === 'up' ? 'status-online' : 'status-offline'
                )} />
                <div>
                  <span className="font-medium text-sm">{iface.name}</span>
                  <span className={cn(
                    "ml-2 text-[10px] px-1.5 py-0.5 rounded",
                    iface.type === 'WAN' ? 'bg-primary/20 text-primary' :
                    iface.type === 'LAN' ? 'bg-status-success/20 text-status-success' :
                    iface.type === 'DMZ' ? 'bg-status-warning/20 text-status-warning' :
                    'bg-muted text-muted-foreground'
                  )}>
                    {iface.type}
                  </span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{iface.speed ?? '—'}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="text-muted-foreground mb-0.5">IP Address</div>
                <div className="font-mono">{iface.ip_address ?? '—'}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-0.5">MAC</div>
                <div className="font-mono text-[11px]">{iface.mac ?? '—'}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
              <div className="flex items-center justify-between bg-traffic-inbound/10 rounded px-2 py-1.5">
                <span className="text-traffic-inbound">IN</span>
                <span className="font-mono">{formatBytes(iface.rx_bytes)}</span>
              </div>
              <div className="flex items-center justify-between bg-traffic-outbound/10 rounded px-2 py-1.5">
                <span className="text-traffic-outbound">OUT</span>
                <span className="font-mono">{formatBytes(iface.tx_bytes)}</span>
              </div>
            </div>
          </div>
        ))}
        {ifaces.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground text-center">No interfaces found</div>
        )}
      </div>
    </div>
  );
}
