import { useTrafficHistory } from '@/hooks/useDashboardData';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export function TrafficGraph() {
  const { data: trafficStats = [] } = useTrafficHistory(24);

  const data = trafficStats.map((stat) => ({
    time: new Date(stat.recorded_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    inbound: stat.inbound,
    outbound: stat.outbound,
    blocked: stat.blocked,
  }));

  return (
    <div className="panel">
      <div className="panel-header">
        <h3 className="text-sm font-medium">Traffic Overview (24h)</h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-traffic-inbound" />
            <span className="text-muted-foreground">Inbound</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-traffic-outbound" />
            <span className="text-muted-foreground">Outbound</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-traffic-blocked" />
            <span className="text-muted-foreground">Blocked</span>
          </div>
        </div>
      </div>
      <div className="panel-body">
        <div className="h-64">
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--traffic-inbound))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--traffic-inbound))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOutbound" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--traffic-outbound))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--traffic-outbound))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="time" axisLine={false} tickLine={false}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
                <YAxis axisLine={false} tickLine={false}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${v}Mb`} />
                <Tooltip contentStyle={{
                  backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))',
                  borderRadius: '6px', fontSize: '12px'
                }} labelStyle={{ color: 'hsl(var(--foreground))' }} />
                <Area type="monotone" dataKey="inbound" stroke="hsl(var(--traffic-inbound))" fillOpacity={1} fill="url(#colorInbound)" strokeWidth={2} />
                <Area type="monotone" dataKey="outbound" stroke="hsl(var(--traffic-outbound))" fillOpacity={1} fill="url(#colorOutbound)" strokeWidth={2} />
                <Area type="monotone" dataKey="blocked" stroke="hsl(var(--traffic-blocked))" fill="transparent" strokeWidth={1.5} strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              No traffic data available yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
