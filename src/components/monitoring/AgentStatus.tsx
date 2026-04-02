import { useAgentStatus } from '@/hooks/useAgentStatus';
import { cn } from '@/lib/utils';
import { Activity, Clock, Shield, Server, Network, ShieldAlert, Wifi } from 'lucide-react';

function timeAgo(iso: string | null): string {
  if (!iso) return 'N/A';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function AgentStatus() {
  const { data: agent, isLoading } = useAgentStatus();

  if (isLoading) {
    return (
      <div className="panel animate-pulse">
        <div className="panel-header"><span>Agent Status</span></div>
        <div className="panel-body"><div className="h-32 bg-muted rounded" /></div>
      </div>
    );
  }

  if (!agent) return null;

  const statusItems = [
    {
      icon: Shield,
      label: 'Applied Rules',
      value: agent.appliedRules,
      color: 'text-primary',
    },
    {
      icon: Network,
      label: 'Active Interfaces',
      value: agent.activeInterfaces,
      color: 'text-primary',
    },
    {
      icon: Wifi,
      label: 'VPN Tunnels',
      value: agent.vpnTunnels,
      color: 'text-primary',
    },
    {
      icon: ShieldAlert,
      label: 'Threats (24h)',
      value: agent.threatEventsToday,
      color: agent.threatEventsToday > 50 ? 'text-destructive' : agent.threatEventsToday > 20 ? 'text-[hsl(40,90%,50%)]' : 'text-primary',
    },
  ];

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="font-medium">Sonaro Agent</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">v{agent.agentVersion}</span>
        </div>
      </div>
      <div className="panel-body space-y-4">
        {/* Connection Status Banner */}
        <div className={cn(
          "flex items-center justify-between p-3 rounded border",
          agent.connected
            ? "bg-primary/5 border-primary/20"
            : "bg-destructive/5 border-destructive/20"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-3 w-3 rounded-full",
              agent.connected ? "bg-primary animate-pulse" : "bg-destructive"
            )} />
            <div>
              <div className={cn(
                "text-sm font-semibold",
                agent.connected ? "text-primary" : "text-destructive"
              )}>
                {agent.connected ? 'Connected' : 'Disconnected'}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Server className="h-3 w-3" />
                {agent.hostname}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Last sync
            </div>
            <div className="text-sm font-mono font-medium">
              {timeAgo(agent.lastSyncTime)}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statusItems.map((item) => (
            <div key={item.label} className="text-center p-3 bg-secondary/50 rounded border border-border/50">
              <item.icon className={cn("h-5 w-5 mx-auto mb-1", item.color)} />
              <div className={cn("text-xl font-bold", item.color)}>{item.value}</div>
              <div className="text-[10px] text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
