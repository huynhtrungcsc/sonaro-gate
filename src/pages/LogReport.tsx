import { useState, useEffect } from 'react';
import { useAuditLogs, useSystemSettings } from '@/hooks/useDbData';
import { Shell } from '@/components/layout/Shell';
import { StatsBar } from '@/components/ui/stats-bar';
import {
  Download,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  FileText,
  AlertTriangle,
  Shield,
  Globe,
  Server,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { systemSettingsApi } from '@/lib/api';

interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'traffic' | 'event' | 'security' | 'system';
  level: 'info' | 'warning' | 'error' | 'critical';
  source: string;
  message: string;
  details?: string;
}

const getToken = () => localStorage.getItem('sonaro_token') ?? '';

async function apiFetch(path: string): Promise<any> {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const LogReport = () => {
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState('today');
  const [generating, setGenerating] = useState<string | null>(null);
  const { data: rawLogs = [] } = useAuditLogs(1000);
  const { data: dbSettings = [] } = useSystemSettings();

  // Log Settings state
  const [retentionDays, setRetentionDays] = useState(30);
  const [maxStorageGb, setMaxStorageGb] = useState(10);
  const [syslogServer, setSyslogServer] = useState('');
  const [syslogPort, setSyslogPort] = useState(514);
  const [syslogEnabled, setSyslogEnabled] = useState(false);

  // Load log settings from DB
  useEffect(() => {
    if (!(dbSettings as any[]).length) return;
    const get = (k: string) => (dbSettings as any[]).find((s: any) => s.key === k)?.value;
    const r = get('log_retention_days'); if (r) setRetentionDays(parseInt(r));
    const m = get('log_max_storage_gb'); if (m) setMaxStorageGb(parseInt(m));
    const s = get('log_syslog_server'); if (s) setSyslogServer(s);
    const p = get('log_syslog_port'); if (p) setSyslogPort(parseInt(p));
    const e = get('log_syslog_enabled'); if (e) setSyslogEnabled(e === 'true');
  }, [dbSettings]);

  const saveSettingsMut = useMutation({
    mutationFn: async () => {
      const pairs: [string, string][] = [
        ['log_retention_days', String(retentionDays)],
        ['log_max_storage_gb', String(maxStorageGb)],
        ['log_syslog_server', syslogServer],
        ['log_syslog_port', String(syslogPort)],
        ['log_syslog_enabled', String(syslogEnabled)],
      ];
      for (const [k, v] of pairs) await systemSettingsApi.upsert(k, v);
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
    },
    onSuccess: () => toast.success('Log settings saved'),
    onError: () => toast.error('Failed to save log settings'),
  });

  const logTypes = [
    { value: 'all', label: 'All Types', icon: FileText },
    { value: 'traffic', label: 'Traffic', icon: Globe },
    { value: 'security', label: 'Security', icon: Shield },
    { value: 'event', label: 'Events', icon: AlertTriangle },
    { value: 'system', label: 'System', icon: Server },
  ];

  const logLevels = ['all', 'info', 'warning', 'error', 'critical'];

  const logs = (rawLogs as any[]).map((l: any): LogEntry => ({
    id: l.id,
    timestamp: new Date(l.created_at),
    type: l.resource_type === 'firewall_rules' || l.resource_type === 'nat_rules' ? 'security'
        : l.resource_type === 'network_interfaces' ? 'traffic'
        : l.resource_type === 'system' ? 'system'
        : 'event',
    level: l.action?.includes('DELETE') ? 'warning'
         : l.action?.includes('error') ? 'error'
         : 'info',
    source: l.ip_address || 'system',
    message: `${l.action} ${l.resource_type ? `[${l.resource_type}]` : ''}${l.resource_id ? ` #${String(l.resource_id).slice(0, 8)}` : ''}`,
    details: l.details,
  }));

  // Date range filter
  const now = Date.now();
  const dateFrom: Record<string, number> = {
    today: now - 86400 * 1000,
    yesterday: now - 2 * 86400 * 1000,
    week: now - 7 * 86400 * 1000,
    month: now - 30 * 86400 * 1000,
  };

  const filteredLogs = logs.filter(log => {
    if (log.timestamp.getTime() < (dateFrom[dateRange] ?? 0)) return false;
    if (selectedType !== 'all' && log.type !== selectedType) return false;
    if (selectedLevel !== 'all' && log.level !== selectedLevel) return false;
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !log.source.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const getLevelStyle = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'error':    return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'warning':  return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:         return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'traffic':  return <Globe size={12} className="text-blue-500" />;
      case 'security': return <Shield size={12} className="text-red-500" />;
      case 'event':    return <AlertTriangle size={12} className="text-yellow-500" />;
      case 'system':   return <Server size={12} className="text-gray-500" />;
      default:         return <FileText size={12} className="text-gray-500" />;
    }
  };

  const escapeCSV = (value: string) => {
    const s = String(value ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const handleExportCSV = () => {
    const csv = ['Timestamp,Type,Level,Source,Message,Details']
      .concat(filteredLogs.map(log => [
        log.timestamp.toISOString(), log.type, log.level,
        escapeCSV(log.source), escapeCSV(log.message), escapeCSV(log.details || ''),
      ].join(',')))
      .join('\n');
    downloadFile('\uFEFF' + csv, `logs-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
    toast.success(`Exported ${filteredLogs.length} log entries to CSV`);
  };

  const handleExportText = () => {
    const lines = [
      `Sonaro Gate — Log Export`,
      `Generated: ${new Date().toISOString()}`,
      `Period: ${dateRange}  |  Type: ${selectedType}  |  Level: ${selectedLevel}`,
      `Entries: ${filteredLogs.length}`,
      '─'.repeat(100),
      ...filteredLogs.map(log =>
        `[${log.timestamp.toISOString()}] [${log.level.toUpperCase().padEnd(8)}] [${log.type.padEnd(8)}] ${log.source.padEnd(15)} ${log.message}`
      ),
    ];
    downloadFile(lines.join('\n'), `logs-${new Date().toISOString().split('T')[0]}.log`, 'text/plain');
    toast.success(`Exported ${filteredLogs.length} entries as text`);
  };

  // ── Report Generators ──────────────────────────────────────────
  const generateReport = async (type: 'traffic' | 'security' | 'system') => {
    setGenerating(type);
    try {
      const now = new Date();
      const reportDate = now.toISOString().split('T')[0];
      let reportData: any = { generatedAt: now.toISOString(), type, period: '30 days' };

      if (type === 'traffic') {
        const [rules, trafficStats, auditRaw] = await Promise.allSettled([
          apiFetch('/api/data/firewall_rules?select=id,name,action,source,destination,service,hit_count&order=hit_count.desc&limit=20'),
          apiFetch('/api/data/traffic_stats?order=recorded_at.desc&limit=100'),
          apiFetch('/api/data/audit_logs?select=created_at,action,resource_type,ip_address&order=created_at.desc&limit=200'),
        ]);
        reportData.title = 'Traffic Report';
        reportData.topFirewallRules = rules.status === 'fulfilled' ? rules.value : [];
        reportData.recentTrafficStats = trafficStats.status === 'fulfilled' ? trafficStats.value : [];
        reportData.auditActivity = auditRaw.status === 'fulfilled' ? auditRaw.value : [];
        reportData.summary = {
          totalRules: (rules.status === 'fulfilled' ? rules.value : []).length,
          totalHits: (rules.status === 'fulfilled' ? rules.value : []).reduce((s: number, r: any) => s + (r.hit_count || 0), 0),
          statsRecords: (trafficStats.status === 'fulfilled' ? trafficStats.value : []).length,
        };
      } else if (type === 'security') {
        const [threats, auditRaw, certs] = await Promise.allSettled([
          apiFetch('/api/data/threat_events?order=created_at.desc&limit=200'),
          apiFetch('/api/data/audit_logs?select=id,created_at,action,resource_type,ip_address,details&order=created_at.desc&limit=500'),
          apiFetch('/api/data/certificates?select=id,name,status,expiry_date&limit=50'),
        ]);
        reportData.title = 'Security Report';
        reportData.threatEvents = threats.status === 'fulfilled' ? threats.value : [];
        reportData.auditLogs = auditRaw.status === 'fulfilled' ? auditRaw.value : [];
        reportData.certificates = certs.status === 'fulfilled' ? certs.value : [];
        const tevts = threats.status === 'fulfilled' ? threats.value as any[] : [];
        reportData.summary = {
          totalThreats: tevts.length,
          criticalThreats: tevts.filter((t: any) => t.severity === 'critical').length,
          blockedThreats: tevts.filter((t: any) => t.action === 'block').length,
          auditEntries: (auditRaw.status === 'fulfilled' ? auditRaw.value as any[] : []).length,
        };
      } else {
        const [metrics, settings, ifaces] = await Promise.allSettled([
          apiFetch('/api/data/system_metrics?order=recorded_at.desc&limit=48'),
          apiFetch('/api/data/system_settings?select=key,value'),
          apiFetch('/api/system/interfaces'),
        ]);
        reportData.title = 'System Report';
        reportData.recentMetrics = metrics.status === 'fulfilled' ? metrics.value : [];
        reportData.systemSettings = settings.status === 'fulfilled' ? settings.value : [];
        reportData.networkInterfaces = ifaces.status === 'fulfilled' ? ifaces.value : [];
        const mets = metrics.status === 'fulfilled' ? metrics.value as any[] : [];
        if (mets.length > 0) {
          const latest = mets[0];
          reportData.summary = {
            hostname: latest.hostname,
            uptime: latest.uptime,
            avgCpu: (mets.reduce((s, m) => s + parseFloat(m.cpu_usage || 0), 0) / mets.length).toFixed(1) + '%',
            avgMemory: (mets.reduce((s, m) => s + parseFloat(m.memory_used || 0), 0) / mets.length / 1e9).toFixed(2) + ' GB avg used',
            diskUsage: mets[0].disk_used ? `${(mets[0].disk_used / mets[0].disk_total * 100).toFixed(1)}%` : '—',
            dataPoints: mets.length,
          };
        }
      }

      const json = JSON.stringify(reportData, null, 2);
      downloadFile(json, `sonaro-${type}-report-${reportDate}.json`, 'application/json');
      toast.success(`${reportData.title} generated and downloaded`);
    } catch (err: any) {
      toast.error(`Failed to generate report: ${err.message}`);
    } finally {
      setGenerating(null);
    }
  };

  // Stats
  const stats = {
    total: filteredLogs.length,
    critical: filteredLogs.filter(l => l.level === 'critical').length,
    errors: filteredLogs.filter(l => l.level === 'error').length,
    warnings: filteredLogs.filter(l => l.level === 'warning').length,
  };

  return (
    <Shell>
      <div className="space-y-0">
        {/* Header */}
        <div className="section-header-neutral">
          <div className="flex items-center gap-2">
            <FileText size={14} />
            <span className="font-semibold">Log & Report</span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="forti-toolbar">
          <button className="forti-toolbar-btn" onClick={() => queryClient.invalidateQueries({ queryKey: ['audit-logs'] })}>
            <RefreshCw size={12} />
            <span>Refresh</span>
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={handleExportCSV}>
            <Download size={12} />
            <span>Export CSV</span>
          </button>
          <button className="forti-toolbar-btn" onClick={handleExportText}>
            <Download size={12} />
            <span>Export Text</span>
          </button>
          <div className="forti-toolbar-separator" />
          <div className="flex items-center gap-1">
            <Calendar size={12} className="text-[#666]" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="forti-select"
            >
              <option value="today">Last 24 Hours</option>
              <option value="yesterday">Last 48 Hours</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>
          <div className="flex-1" />
          <div className="forti-search">
            <Search size={12} className="text-[#999]" />
            <input
              type="text"
              placeholder="Search logs…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Stats Bar */}
        <StatsBar items={[
          { value: stats.total,    label: 'Visible Entries' },
          { value: stats.critical, label: 'Critical',  color: 'text-red-600' },
          { value: stats.errors,   label: 'Errors',    color: 'text-orange-600' },
          { value: stats.warnings, label: 'Warnings',  color: 'text-yellow-600' },
        ]} />

        {/* Tabs */}
        <Tabs defaultValue="logs" className="w-full">
          <div className="bg-[#f0f0f0] border-x border-b border-[#ddd]">
            <TabsList className="bg-transparent h-auto p-0 rounded-none">
              {['logs', 'reports', 'settings'].map(t => (
                <TabsTrigger
                  key={t}
                  value={t}
                  className="data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-b-[hsl(142,70%,35%)] rounded-none px-4 py-2 text-[11px] capitalize"
                >
                  {t === 'logs' ? 'Log Viewer' : t === 'reports' ? 'Reports' : 'Log Settings'}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* ── Log Viewer ─────────────────────────────────────────── */}
          <TabsContent value="logs" className="mt-0">
            {/* Filter Bar */}
            <div className="flex items-center gap-2 px-3 py-2 bg-[#f5f5f5] border-x border-b border-[#ddd]">
              <Filter size={12} className="text-[#666]" />
              <span className="text-[11px] text-[#666]">Type:</span>
              <div className="flex items-center gap-0.5">
                {logTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setSelectedType(type.value)}
                    className={cn(
                      'px-2 py-1 text-[11px] font-medium border transition-colors flex items-center gap-1',
                      selectedType === type.value
                        ? 'bg-[hsl(142,70%,35%)] text-white border-[hsl(142,75%,28%)]'
                        : 'bg-white text-[#666] border-[#ccc] hover:bg-[#f5f5f5]'
                    )}
                  >
                    <type.icon size={10} />
                    {type.label}
                  </button>
                ))}
              </div>
              <div className="forti-toolbar-separator" />
              <span className="text-[11px] text-[#666]">Level:</span>
              <div className="flex items-center gap-0.5">
                {logLevels.map((level) => (
                  <button
                    key={level}
                    onClick={() => setSelectedLevel(level)}
                    className={cn(
                      'px-2 py-1 text-[11px] font-medium border transition-colors capitalize',
                      selectedLevel === level
                        ? 'bg-[hsl(142,70%,35%)] text-white border-[hsl(142,75%,28%)]'
                        : 'bg-white text-[#666] border-[#ccc] hover:bg-[#f5f5f5]'
                    )}
                  >
                    {level === 'all' ? 'All' : level}
                  </button>
                ))}
              </div>
              <div className="flex-1" />
              <span className="text-[11px] text-[#666]">{filteredLogs.length} entries</span>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-24">Date</th>
                  <th className="w-20">Time</th>
                  <th className="w-20">Type</th>
                  <th className="w-20">Level</th>
                  <th className="w-24">Source</th>
                  <th>Message</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-6 text-[#999]">No log entries match the current filters</td></tr>
                ) : filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="text-[#666]">{formatDate(log.timestamp)}</td>
                    <td className="mono text-[#666]">{formatTime(log.timestamp)}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        {getTypeIcon(log.type)}
                        <span className="capitalize text-[#333]">{log.type}</span>
                      </div>
                    </td>
                    <td>
                      <span className={cn('forti-tag', getLevelStyle(log.level))}>
                        {log.level.toUpperCase()}
                      </span>
                    </td>
                    <td className="text-[#666] font-mono text-[10px]">{log.source}</td>
                    <td className="font-medium text-[#333]">{log.message}</td>
                    <td className="text-[#888] text-[10px]">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>

          {/* ── Reports ────────────────────────────────────────────── */}
          <TabsContent value="reports" className="mt-0 p-4 bg-white border-x border-b border-[#ddd]">
            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  key: 'traffic' as const,
                  title: 'Traffic Report',
                  desc: 'Firewall rule hit counts, top traffic sources, bandwidth stats, and connection activity.',
                  color: 'text-blue-600',
                },
                {
                  key: 'security' as const,
                  title: 'Security Report',
                  desc: 'Threat events, blocked attacks, IPS/AV activity, and certificate status.',
                  color: 'text-red-600',
                },
                {
                  key: 'system' as const,
                  title: 'System Report',
                  desc: 'CPU/memory/disk resource usage over time, configuration, and network interfaces.',
                  color: 'text-green-600',
                },
              ].map(card => (
                <div key={card.key} className="border border-[#ddd] bg-white flex flex-col">
                  <div className="section-header flex items-center gap-2">
                    <span className={card.color}>{card.title}</span>
                  </div>
                  <div className="p-3 space-y-3 flex-1 flex flex-col">
                    <p className="text-[11px] text-[#666] flex-1">{card.desc}</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] text-[#888]">
                        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                        <span>Reads live data from database</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#888]">
                        <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                        <span>Downloads as JSON file</span>
                      </div>
                    </div>
                    <button
                      className="forti-btn forti-btn-primary w-full"
                      onClick={() => generateReport(card.key)}
                      disabled={generating === card.key}
                    >
                      <Download size={12} className="mr-1" />
                      {generating === card.key ? 'Generating…' : 'Generate Report'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-[#f5f5f5] border border-[#ddd] text-[11px] text-[#666]">
              <strong className="text-[#333]">About Reports:</strong> Each report queries live data from the database and downloads as a JSON file.
              Traffic Report includes firewall rule statistics. Security Report includes threat events and audit logs.
              System Report includes resource metrics and configuration summary.
            </div>
          </TabsContent>

          {/* ── Log Settings ───────────────────────────────────────── */}
          <TabsContent value="settings" className="mt-0 p-4 bg-white border-x border-b border-[#ddd]">
            <div className="space-y-4">
              <div className="section">
                <div className="section-header-neutral">
                  <span>Log Retention</span>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="forti-label">Retention Period (Days)</label>
                      <input
                        type="number" min={1} max={365}
                        className="forti-input w-full"
                        value={retentionDays}
                        onChange={(e) => setRetentionDays(parseInt(e.target.value) || 30)}
                      />
                      <span className="text-[10px] text-[#888]">Logs older than this will be purged automatically</span>
                    </div>
                    <div>
                      <label className="forti-label">Max Storage (GB)</label>
                      <input
                        type="number" min={1} max={500}
                        className="forti-input w-full"
                        value={maxStorageGb}
                        onChange={(e) => setMaxStorageGb(parseInt(e.target.value) || 10)}
                      />
                      <span className="text-[10px] text-[#888]">Oldest logs are removed when limit is reached</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="section">
                <div className="section-header-neutral">
                  <span>Remote Syslog (RFC 3164)</span>
                </div>
                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <label className="forti-label mb-0">Enable Remote Syslog</label>
                    <input
                      type="checkbox"
                      checked={syslogEnabled}
                      onChange={(e) => setSyslogEnabled(e.target.checked)}
                      className="accent-[hsl(142,70%,35%)]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="forti-label">Syslog Server IP / Hostname</label>
                      <input
                        type="text"
                        className="forti-input w-full"
                        placeholder="192.168.1.100"
                        value={syslogServer}
                        onChange={(e) => setSyslogServer(e.target.value)}
                        disabled={!syslogEnabled}
                      />
                    </div>
                    <div>
                      <label className="forti-label">UDP Port</label>
                      <input
                        type="number" min={1} max={65535}
                        className="forti-input w-full"
                        value={syslogPort}
                        onChange={(e) => setSyslogPort(parseInt(e.target.value) || 514)}
                        disabled={!syslogEnabled}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-[#888]">
                    When enabled, all log entries will be forwarded to the remote syslog server in RFC 3164 format.
                    Requires Sonaro Gate to be running as root on Ubuntu 24.04.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  className="forti-btn forti-btn-secondary"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['system-settings'] })}
                >
                  Cancel
                </button>
                <button
                  className="forti-btn forti-btn-primary"
                  onClick={() => saveSettingsMut.mutate()}
                  disabled={saveSettingsMut.isPending}
                >
                  {saveSettingsMut.isPending ? 'Saving…' : 'Apply Settings'}
                </button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Shell>
  );
};

export default LogReport;
