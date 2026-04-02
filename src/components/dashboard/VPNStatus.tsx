import { cn } from '@/lib/utils';
import { useVPN } from '@/hooks/useDashboardData';
import { formatBytes, formatUptimeShort as formatUptime } from '@/lib/formatters';

export function VPNStatus() {
  const { data: vpnTunnels = [], isLoading } = useVPN();
  const connected = vpnTunnels.filter(v => v.status === 'connected').length;

  return (
    <div className="panel">
      <div className="panel-header">
        <h3 className="text-sm font-medium">VPN Tunnels</h3>
        <span className="text-xs text-muted-foreground">
          {connected}/{vpnTunnels.length} connected
        </span>
      </div>
      <div className="divide-y divide-border">
        {vpnTunnels.map((vpn) => (
          <div key={vpn.id} className="p-4 hover:bg-secondary/30 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "status-dot",
                  vpn.status === 'connected' ? 'status-online' : 'status-offline'
                )} />
                <span className="font-medium text-sm">{vpn.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded uppercase">
                  {vpn.type}
                </span>
              </div>
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded",
                vpn.status === 'connected' ? 'bg-status-success/20 text-status-success' : 'bg-muted text-muted-foreground'
              )}>
                {vpn.status.toUpperCase()}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
              <div>
                <span className="text-muted-foreground">Remote: </span>
                <span className="font-mono">{vpn.remote_gateway ?? '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Uptime: </span>
                <span>{formatUptime(vpn.uptime)}</span>
              </div>
            </div>
            {vpn.status === 'connected' && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between bg-traffic-inbound/10 rounded px-2 py-1">
                  <span className="text-traffic-inbound">IN</span>
                  <span className="font-mono">{formatBytes(vpn.bytes_in)}</span>
                </div>
                <div className="flex items-center justify-between bg-traffic-outbound/10 rounded px-2 py-1">
                  <span className="text-traffic-outbound">OUT</span>
                  <span className="font-mono">{formatBytes(vpn.bytes_out)}</span>
                </div>
              </div>
            )}
          </div>
        ))}
        {vpnTunnels.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground text-center">No VPN tunnels configured</div>
        )}
      </div>
    </div>
  );
}
