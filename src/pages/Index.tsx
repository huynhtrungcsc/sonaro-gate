import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, ChevronRight, Loader2
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import {
  useLatestMetrics, useTrafficHistory, useInterfaces,
  useVPN, useRecentThreats, useFirewallStats
} from '@/hooks/useDashboardData';
import { useSystemSettings } from '@/hooks/useDbData';
import { useRealtimeMetrics } from '@/hooks/useRealtimeMetrics';
import { formatUptime, formatBytes } from '@/lib/formatters';

// ─── Widget wrapper ─────────────────────────────
const Widget = ({
  title, children, className = '', headerActions, loading
}: {
  title: string; children: React.ReactNode; className?: string;
  headerActions?: React.ReactNode; loading?: boolean;
}) => (
  <div className={cn("widget", className)}>
    <div className="widget-header">
      <span>{title}</span>
      <div className="flex items-center gap-2">
        {loading && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
        {headerActions}
      </div>
    </div>
    <div className="widget-body">{children}</div>
  </div>
);


// ─── Dashboard ──────────────────────────────────
const Dashboard = () => {
  const liveState = useRealtimeMetrics();
  const metrics = useLatestMetrics();
  const traffic = useTrafficHistory(24);
  const interfaces = useInterfaces();
  const vpn = useVPN();
  const threats = useRecentThreats();
  const fwStats = useFirewallStats();

  const settings = useSystemSettings();

  const getSetting = (key: string, fallback: string) => {
    const row = (settings.data ?? []).find((s: any) => s.key === key);
    return row?.value ?? fallback;
  };

  // ── Derived data — WebSocket live data takes priority over polled data ──
  const m: any = liveState.metrics ?? metrics.data;
  const cpuUsage = m?.cpu_usage ?? 0;
  const memPct = m ? Math.round((m.memory_used / m.memory_total) * 100) : 0;
  const diskPct = m ? Math.round((m.disk_used / m.disk_total) * 100) : 0;

  const trafficData = (traffic.data ?? []).map(t => ({
    time: new Date(t.recorded_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    inbound: t.inbound, outbound: t.outbound,
  }));

  const ifaces = interfaces.data ?? [];
  const vpnTunnels = vpn.data ?? [];
  const threatEvents = threats.data ?? [];
  const connectedVPNs = vpnTunnels.filter(v => v.status === 'connected').length;
  const activePortCount = ifaces.filter(i => i.status === 'up').length;

  const threatCounts = {
    critical: threatEvents.filter(t => t.severity === 'critical').length,
    high: threatEvents.filter(t => t.severity === 'high').length,
    medium: threatEvents.filter(t => t.severity === 'medium').length,
    low: threatEvents.filter(t => t.severity === 'low').length,
  };

  return (
    <Shell>
      <div className="space-y-3">
        {/* Minimal real-time status strip */}
        <div className="forti-toolbar">
          <div className="flex items-center gap-2 flex-1 text-[10px] text-[#999]">
            {liveState.lastUpdate && (
              <span>Updated {liveState.lastUpdate.toLocaleTimeString()}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {metrics.isLoading && <Loader2 size={11} className="animate-spin text-[#bbb]" />}
            <span
              title={liveState.connected ? 'Real-time connected' : 'Reconnecting…'}
              className={cn(
                "inline-block w-1.5 h-1.5 rounded-full",
                liveState.connected ? "bg-green-500 animate-pulse" : "bg-amber-400"
              )}
            />
          </div>
        </div>

        {/* Row 1 */}
        <div className="grid grid-cols-3 gap-3">
          <Widget title="System Information" className="col-span-2" loading={metrics.isLoading || settings.isLoading}>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[11px]">
              {[
                ['Hostname', m?.hostname ?? getSetting('hostname', '—')],
                ['Serial Number', getSetting('serial_number', 'SONARO-GATE')],
                ['Operation Mode', getSetting('operation_mode', 'NAT')],
                ['HA Status', getSetting('ha_mode', 'Standalone')],
                ['Firmware', getSetting('firmware_version', '2025.1 LTS')],
                ['System Time', new Date().toLocaleString()],
                ['Uptime', m ? formatUptime(m.uptime) : '—'],
                ['CPU Cores', m ? `${m.cpu_cores} cores / ${m.cpu_temperature}°C` : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-1 border-b border-[#eee]">
                  <span className="text-[#666]">{label}:</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
          </Widget>
          <Widget title="Licenses" loading={settings.isLoading}>
            <div className="space-y-1">
              {[
                { name: 'VM License', key: 'license_vm_status' },
                { name: 'Support', key: 'license_support_status' },
                { name: 'IDS & IPS', key: 'license_ids_status' },
                { name: 'AntiVirus', key: 'license_av_status' },
                { name: 'Web Filtering', key: 'license_webfilter_status' },
              ].map(lic => {
                const status = getSetting(lic.key, 'Not Licensed');
                const isValid = status.toLowerCase() === 'valid';
                return (
                  <div key={lic.key} className="flex items-center justify-between text-[11px] py-0.5">
                    <span className="text-[#666]">{lic.name}</span>
                    <span className={`inline-flex items-center gap-1 ${isValid ? 'text-[#4caf50]' : 'text-[#e53935]'}`}>
                      <CheckCircle2 size={12} /> {status}
                    </span>
                  </div>
                );
              })}
            </div>
          </Widget>
        </div>

        {/* Row 2 - Resources + Traffic */}
        <div className="grid grid-cols-3 gap-3">
          <Widget title="Resources" loading={metrics.isLoading}>
            <div className="space-y-3">
              {[{ label: 'CPU', value: cpuUsage }, { label: 'Memory', value: memPct }, { label: 'Disk', value: diskPct }].map(({ label, value }) => (
                <div key={label}>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-[#666]">{label}</span>
                    <span className="font-medium">{value}%</span>
                  </div>
                  <div className="forti-progress">
                    <div className={cn("forti-progress-bar", value > 80 ? "red" : value > 60 ? "orange" : "green")} style={{ width: `${value}%` }} />
                  </div>
                </div>
              ))}
              {m && <div className="text-[10px] text-[#999] pt-1 border-t border-[#eee]">Load: {m.load_1m} / {m.load_5m} / {m.load_15m}</div>}
            </div>
          </Widget>
          <Widget title="Interface Bandwidth (Mbps)" className="col-span-2" loading={traffic.isLoading}>
            <div className="h-32">
              {trafficData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trafficData.slice(-12)} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#999" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#999" />
                    <Tooltip contentStyle={{ fontSize: 11, background: '#fff', border: '1px solid #ddd' }} />
                    <Area type="monotone" dataKey="inbound" stroke="#4caf50" fill="#4caf50" fillOpacity={0.3} />
                    <Area type="monotone" dataKey="outbound" stroke="#2196f3" fill="#2196f3" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-[11px] text-[#999]">No traffic data yet</div>
              )}
            </div>
          </Widget>
        </div>

        {/* Row 3 - Unit + Interfaces */}
        <div className="grid grid-cols-3 gap-3">
          <Widget title="Unit Operation" loading={interfaces.isLoading}>
            <div className="flex flex-col items-center py-2">
              <div className="bg-[#333] rounded px-4 py-2 text-center mb-2">
                <div className="text-[10px] text-gray-400 mb-1">SONARO</div>
                <div className="text-[11px] text-white font-bold">Sonaro Gate</div>
                <div className="flex items-center justify-center gap-1 mt-2">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div key={i} className={cn("forti-port", i < activePortCount ? "up" : "down")}>{i + 1}</div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#4caf50]" />Connected: {activePortCount}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#ccc]" />Disconnected: {10 - activePortCount}</span>
              </div>
            </div>
          </Widget>
          <Widget title="Top Interfaces by Bandwidth" className="col-span-2" loading={interfaces.isLoading}>
            <table className="w-full text-[11px]">
              <thead><tr className="text-left text-[#666]"><th className="pb-1">Interface</th><th className="pb-1">IP</th><th className="pb-1">Status</th><th className="pb-1 text-right">Inbound</th><th className="pb-1 text-right">Outbound</th></tr></thead>
              <tbody>
                {ifaces.length > 0 ? ifaces.slice(0, 6).map(iface => (
                  <tr key={iface.id} className="border-t border-[#eee]">
                    <td className="py-1.5 font-medium">{iface.name}</td>
                    <td className="py-1.5 font-mono text-[#666]">{iface.ip_address ?? '—'}</td>
                    <td className="py-1.5"><span className={cn("inline-flex items-center gap-1", iface.status === 'up' ? 'text-[#4caf50]' : 'text-[#999]')}><span className={cn("w-2 h-2 rounded-full", iface.status === 'up' ? 'bg-[#4caf50]' : 'bg-[#ccc]')} />{iface.status === 'up' ? 'Up' : 'Down'}</span></td>
                    <td className="py-1.5 text-right text-[#666]">{formatBytes(iface.rx_bytes)}</td>
                    <td className="py-1.5 text-right text-[#666]">{formatBytes(iface.tx_bytes)}</td>
                  </tr>
                )) : <tr><td colSpan={5} className="py-4 text-center text-[#999]">No interface data</td></tr>}
              </tbody>
            </table>
          </Widget>
        </div>

        {/* Row 4 - Security + Sessions */}
        <div className="grid grid-cols-3 gap-3">
          <Widget title="Security Events (Last 24 Hours)" loading={threats.isLoading}>
            <div className="space-y-2">
              {[
                { label: 'Critical', count: threatCounts.critical, color: 'bg-red-500', textColor: 'text-red-500' },
                { label: 'High', count: threatCounts.high, color: 'bg-orange-500', textColor: 'text-orange-500' },
                { label: 'Medium', count: threatCounts.medium, color: 'bg-yellow-500', textColor: 'text-yellow-600' },
                { label: 'Low', count: threatCounts.low, color: 'bg-blue-500', textColor: 'text-blue-500' },
              ].map(({ label, count, color, textColor }) => (
                <div key={label} className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-2"><span className={cn("w-3 h-3 rounded", color)} />{label}</span>
                  <span className={cn("font-bold", textColor)}>{count}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-[#eee] text-[11px] text-[#666]">Total: <span className="font-bold text-foreground">{threatEvents.length}</span></div>
            </div>
            <Link to="/threats" className="mt-3 flex items-center gap-1 text-[11px] text-[#4caf50] hover:underline">View all events <ChevronRight size={12} /></Link>
          </Widget>
          <Widget title="Top Sessions by Source" className="col-span-2" loading={threats.isLoading}>
            <table className="w-full text-[11px]">
              <thead><tr className="text-left text-[#666]"><th className="pb-1">Source</th><th className="pb-1">Destination</th><th className="pb-1">Category</th><th className="pb-1">Action</th><th className="pb-1 text-right">Confidence</th></tr></thead>
              <tbody>
                {threatEvents.length > 0 ? threatEvents.slice(0, 5).map(t => (
                  <tr key={t.id} className="border-t border-[#eee]">
                    <td className="py-1.5 font-mono">{t.source_ip ?? '—'}</td>
                    <td className="py-1.5 font-mono">{t.destination_ip ?? '—'}{t.destination_port ? `:${t.destination_port}` : ''}</td>
                    <td className="py-1.5">{t.category}</td>
                    <td className="py-1.5"><span className={cn("forti-tag text-[10px] inline-block min-w-[80px] text-center", t.action === 'blocked' ? "bg-red-100 text-red-700 border-red-200" : "bg-yellow-100 text-yellow-700 border-yellow-200")}>{t.action.toUpperCase()}</span></td>
                    <td className="py-1.5 text-right">{t.ai_confidence ? `${t.ai_confidence}%` : '—'}</td>
                  </tr>
                )) : <tr><td colSpan={5} className="py-4 text-center text-[#999]">No recent events</td></tr>}
              </tbody>
            </table>
          </Widget>
        </div>

        {/* Row 5 - VPN */}
        <Widget title={`IPsec VPN (${connectedVPNs}/${vpnTunnels.length} connected)`} loading={vpn.isLoading}>
          <table className="w-full text-[11px]">
            <thead><tr className="text-left text-[#666]"><th className="pb-1">Tunnel</th><th className="pb-1">Type</th><th className="pb-1">Remote GW</th><th className="pb-1">Local Net</th><th className="pb-1">Remote Net</th><th className="pb-1">Status</th><th className="pb-1 text-right">In</th><th className="pb-1 text-right">Out</th></tr></thead>
            <tbody>
              {vpnTunnels.length > 0 ? vpnTunnels.map(v => (
                <tr key={v.id} className="border-t border-[#eee]">
                  <td className="py-1.5 font-medium">{v.name}</td>
                  <td className="py-1.5">{v.type.toUpperCase()}</td>
                  <td className="py-1.5 font-mono text-[#666]">{v.remote_gateway ?? '—'}</td>
                  <td className="py-1.5 font-mono text-[#666]">{v.local_network ?? '—'}</td>
                  <td className="py-1.5 font-mono text-[#666]">{v.remote_network ?? '—'}</td>
                  <td className="py-1.5"><span className={cn("inline-flex items-center gap-1", v.status === 'connected' ? 'text-[#4caf50]' : 'text-[#999]')}><span className={cn("w-2 h-2 rounded-full", v.status === 'connected' ? 'bg-[#4caf50]' : 'bg-[#ccc]')} />{v.status === 'connected' ? 'Up' : 'Down'}</span></td>
                  <td className="py-1.5 text-right text-[#666]">{formatBytes(v.bytes_in)}</td>
                  <td className="py-1.5 text-right text-[#666]">{formatBytes(v.bytes_out)}</td>
                </tr>
              )) : <tr><td colSpan={8} className="py-4 text-center text-[#999]">No VPN tunnels</td></tr>}
            </tbody>
          </table>
        </Widget>

        {/* Row 6 - System Summary */}
        <Widget title="System Summary" loading={fwStats.isLoading}>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-[#666]">
                <th className="pb-1.5 font-normal">Resource</th>
                <th className="pb-1.5 font-normal text-right pr-6">Count</th>
                <th className="pb-1.5 font-normal">Details</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[#eee]">
                <td className="py-1.5">Firewall Rules</td>
                <td className="py-1.5 text-right pr-6 font-medium">{fwStats.data?.total ?? 0}</td>
                <td className="py-1.5 text-[#888]">{fwStats.data?.active ?? 0} active</td>
              </tr>
              <tr className="border-t border-[#eee]">
                <td className="py-1.5">VPN Tunnels</td>
                <td className="py-1.5 text-right pr-6 font-medium">{vpnTunnels.length}</td>
                <td className="py-1.5 text-[#888]">{connectedVPNs} of {vpnTunnels.length} connected</td>
              </tr>
              <tr className="border-t border-[#eee]">
                <td className="py-1.5">Threats (24h)</td>
                <td className="py-1.5 text-right pr-6 font-medium">{threatEvents.length}</td>
                <td className="py-1.5 text-[#888]">{threatCounts.critical} critical</td>
              </tr>
              <tr className="border-t border-[#eee]">
                <td className="py-1.5">Interfaces</td>
                <td className="py-1.5 text-right pr-6 font-medium">{ifaces.length}</td>
                <td className="py-1.5 text-[#888]">{activePortCount} of {ifaces.length} up</td>
              </tr>
            </tbody>
          </table>
        </Widget>
      </div>
    </Shell>
  );
};

export default Dashboard;
