import { useState, useMemo } from 'react';
import { Shell } from '@/components/layout/Shell';
import {
  Activity, ArrowDown, ArrowUp, Download, AlertCircle, Loader2
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { toast } from 'sonner';
import { useTrafficHistory, useInterfaces } from '@/hooks/useDashboardData';
import { formatBytes } from '@/lib/formatters';

const CHART_COLORS = ['#2e9e5e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#94a3b8'];

const TIME_RANGE_HOURS: Record<string, number> = {
  '5m': 5 / 60,
  '15m': 15 / 60,
  '1h': 1,
  '6h': 6,
  '24h': 24,
};

const BUCKET_MS: Record<string, number> = {
  '5m': 30_000,
  '15m': 60_000,
  '1h': 120_000,
  '6h': 600_000,
  '24h': 3_600_000,
};

function deriveBandwidthChart(
  rows: any[],
  selectedInterface: string,
  timeRange: string,
): { time: string; inbound: number; outbound: number }[] {
  if (!rows?.length) return [];

  const filtered = selectedInterface === 'all'
    ? rows
    : rows.filter(r => r.interface === selectedInterface);

  const bucketMs = BUCKET_MS[timeRange] ?? 120_000;
  const buckets = new Map<number, { inbound: number; outbound: number }>();

  for (const row of filtered) {
    const ts = new Date(row.recorded_at).getTime();
    const bucket = Math.floor(ts / bucketMs) * bucketMs;
    const prev = buckets.get(bucket) ?? { inbound: 0, outbound: 0 };
    buckets.set(bucket, {
      inbound: prev.inbound + (row.inbound ?? 0),
      outbound: prev.outbound + (row.outbound ?? 0),
    });
  }

  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ts, { inbound, outbound }]) => ({
      time: new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      inbound: Math.round(inbound * 8 / 60 / 1000),
      outbound: Math.round(outbound * 8 / 60 / 1000),
    }));
}

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center py-12 text-[#999]">
    <AlertCircle size={32} className="mb-3 opacity-40" />
    <div className="text-[12px] text-center max-w-xs">{message}</div>
  </div>
);

const TrafficAnalysis = () => {
  const [timeRange, setTimeRange] = useState('1h');
  const [selectedInterface, setSelectedInterface] = useState('all');
  const [activeTab, setActiveTab] = useState<'bandwidth' | 'interfaces' | 'protocols' | 'geo'>('bandwidth');

  const hours = TIME_RANGE_HOURS[timeRange] ?? 1;
  const traffic = useTrafficHistory(hours);
  const ifaces = useInterfaces();

  const ifaceNames: string[] = ['all', ...(ifaces.data?.map((i: any) => i.name) ?? [])];

  const bandwidthData = useMemo(
    () => deriveBandwidthChart(traffic.data ?? [], selectedInterface, timeRange),
    [traffic.data, selectedInterface, timeRange],
  );

  const totalInboundBytes = useMemo(() => {
    const rows = selectedInterface === 'all'
      ? traffic.data ?? []
      : (traffic.data ?? []).filter((r: any) => r.interface === selectedInterface);
    return rows.reduce((s: number, r: any) => s + (r.inbound ?? 0), 0);
  }, [traffic.data, selectedInterface]);

  const totalOutboundBytes = useMemo(() => {
    const rows = selectedInterface === 'all'
      ? traffic.data ?? []
      : (traffic.data ?? []).filter((r: any) => r.interface === selectedInterface);
    return rows.reduce((s: number, r: any) => s + (r.outbound ?? 0), 0);
  }, [traffic.data, selectedInterface]);

  const latestPoint = bandwidthData[bandwidthData.length - 1];

  const handleExport = () => {
    const csvRows = ['Time,Inbound (Kbps),Outbound (Kbps)'];
    bandwidthData.forEach(d => csvRows.push(`${d.time},${d.inbound},${d.outbound}`));
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `traffic-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Traffic data exported');
  };

  const tabs = [
    { key: 'bandwidth' as const, label: 'Bandwidth' },
    { key: 'interfaces' as const, label: 'Interfaces' },
    { key: 'protocols' as const, label: 'Protocols' },
    { key: 'geo' as const, label: 'Geographic' },
  ];

  return (
    <Shell>
      <div className="space-y-3">
        <div className="section-header-neutral">
          <div className="flex items-center gap-2">
            <Activity size={14} />
            <span>Traffic Analysis</span>
          </div>
        </div>

        <div className="forti-toolbar">
          <span className="forti-label-inline mr-1">Interface:</span>
          <select
            className="forti-select w-32"
            value={selectedInterface}
            onChange={e => setSelectedInterface(e.target.value)}
          >
            {ifaceNames.map(n => (
              <option key={n} value={n}>{n === 'all' ? 'All Interfaces' : n.toUpperCase()}</option>
            ))}
          </select>
          <div className="forti-toolbar-separator" />
          <span className="forti-label-inline mr-1">Period:</span>
          <select
            className="forti-select w-20"
            value={timeRange}
            onChange={e => setTimeRange(e.target.value)}
          >
            <option value="5m">5 min</option>
            <option value="15m">15 min</option>
            <option value="1h">1 hour</option>
            <option value="6h">6 hours</option>
            <option value="24h">24 hours</option>
          </select>
          <div className="forti-toolbar-separator" />
          {(traffic.isLoading || ifaces.isLoading) && (
            <Loader2 size={12} className="animate-spin text-muted-foreground" />
          )}
          <button className="forti-toolbar-btn" onClick={handleExport} disabled={!bandwidthData.length}>
            <Download size={12} />
            Export
          </button>
        </div>

        {/* Summary Strip */}
        <div className="summary-strip">
          <div className="summary-item">
            <ArrowDown size={16} className="text-green-600" />
            <div>
              <div className="summary-count text-green-700">{latestPoint?.inbound ?? 0} Kbps</div>
              <div className="summary-label">Current Inbound</div>
            </div>
          </div>
          <div className="forti-toolbar-separator h-8" />
          <div className="summary-item">
            <ArrowUp size={16} className="text-blue-600" />
            <div>
              <div className="summary-count text-blue-700">{latestPoint?.outbound ?? 0} Kbps</div>
              <div className="summary-label">Current Outbound</div>
            </div>
          </div>
          <div className="forti-toolbar-separator h-8" />
          <div className="summary-item">
            <ArrowDown size={16} className="text-[hsl(var(--forti-green))]" />
            <div>
              <div className="summary-count">{formatBytes(totalInboundBytes)}</div>
              <div className="summary-label">Total Inbound (period)</div>
            </div>
          </div>
          <div className="forti-toolbar-separator h-8" />
          <div className="summary-item">
            <ArrowUp size={16} className="text-orange-600" />
            <div>
              <div className="summary-count text-orange-700">{formatBytes(totalOutboundBytes)}</div>
              <div className="summary-label">Total Outbound (period)</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="forti-view-toggle">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`forti-view-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Bandwidth Tab */}
        {activeTab === 'bandwidth' && (
          <div className="section">
            <div className="section-header">
              <div className="flex items-center gap-2">
                <Activity size={12} />
                <span>Bandwidth — Kbps (real data from agent)</span>
              </div>
            </div>
            <div className="section-body">
              {traffic.isLoading ? (
                <div className="flex items-center justify-center h-48 text-[#999] text-[11px] gap-2">
                  <Loader2 size={14} className="animate-spin" /> Loading traffic data...
                </div>
              ) : bandwidthData.length === 0 ? (
                <EmptyState message="No traffic data yet. Data is collected every 60 seconds by the agent. Check back shortly." />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={bandwidthData}>
                    <defs>
                      <linearGradient id="inboundGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2e9e5e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#2e9e5e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="outboundGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
                    <XAxis dataKey="time" tick={{ fill: '#666', fontSize: 10 }} axisLine={{ stroke: '#ccc' }} />
                    <YAxis tick={{ fill: '#666', fontSize: 10 }} axisLine={{ stroke: '#ccc' }} unit=" Kbps" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', fontSize: '11px' }}
                      formatter={(v: number) => [`${v} Kbps`, '']}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Area type="monotone" dataKey="inbound" name="Inbound" stroke="#2e9e5e" fill="url(#inboundGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="outbound" name="Outbound" stroke="#3b82f6" fill="url(#outboundGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        {/* Interfaces Tab */}
        {activeTab === 'interfaces' && (
          <div className="section">
            <div className="section-header">
              <span>Interface Traffic Summary</span>
            </div>
            {ifaces.isLoading ? (
              <div className="flex items-center justify-center h-24 text-[#999] text-[11px] gap-2">
                <Loader2 size={14} className="animate-spin" /> Loading...
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Interface</th>
                    <th>Type</th>
                    <th>IP Address</th>
                    <th>Status</th>
                    <th>Inbound (period)</th>
                    <th>Outbound (period)</th>
                    <th>Speed</th>
                  </tr>
                </thead>
                <tbody>
                  {(ifaces.data?.length ?? 0) === 0 ? (
                    <tr><td colSpan={7} className="text-center text-[#999] py-4">No interfaces detected by agent</td></tr>
                  ) : (ifaces.data ?? []).map((iface: any) => {
                    const rows = (traffic.data ?? []).filter((r: any) => r.interface === iface.name);
                    const inBytes = rows.reduce((s: number, r: any) => s + (r.inbound ?? 0), 0);
                    const outBytes = rows.reduce((s: number, r: any) => s + (r.outbound ?? 0), 0);
                    return (
                      <tr key={iface.name}>
                        <td className="font-medium mono">{iface.name}</td>
                        <td><span className={`forti-tag ${iface.type === 'WAN' ? 'bg-blue-50 text-blue-700 border-blue-200' : iface.type === 'LAN' ? 'bg-green-50 text-green-700 border-green-200' : 'enabled'}`}>{iface.type}</span></td>
                        <td className="mono text-[#333]">{iface.ip_address ?? '—'}</td>
                        <td>
                          <span className={`forti-tag ${iface.status === 'up' ? 'enabled' : 'disabled'}`}>
                            {iface.status?.toUpperCase()}
                          </span>
                        </td>
                        <td className="text-green-700">{formatBytes(inBytes)}</td>
                        <td className="text-blue-700">{formatBytes(outBytes)}</td>
                        <td className="text-[#666]">{iface.speed ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Protocols Tab — requires DPI */}
        {activeTab === 'protocols' && (
          <div className="section">
            <div className="section-header"><span>Protocol Distribution</span></div>
            <EmptyState message="Protocol analysis requires Deep Packet Inspection (DPI). Install the DPI module and configure inspection policies to enable this view." />
          </div>
        )}

        {/* Geo Tab — requires GeoIP */}
        {activeTab === 'geo' && (
          <div className="section">
            <div className="section-header"><span>Geographic Traffic Distribution</span></div>
            <EmptyState message="Geographic analysis requires GeoIP integration. Configure the GeoIP database source in System Settings to enable this view." />
          </div>
        )}
      </div>
    </Shell>
  );
};

export default TrafficAnalysis;
