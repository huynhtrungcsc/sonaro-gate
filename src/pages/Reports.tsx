import { useState } from 'react';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { 
  BarChart3, Download, Calendar, FileText, Clock,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';

const getToken = () => localStorage.getItem('sonaro_token') ?? '';
async function apiFetch(path: string): Promise<any> {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) return [];
  return res.json();
}

interface Report {
  id: string;
  name: string;
  type: 'security' | 'traffic' | 'system' | 'compliance';
  schedule: 'daily' | 'weekly' | 'monthly' | 'on-demand';
  lastGenerated?: Date;
  size?: string;
  status: 'ready' | 'generating' | 'scheduled';
}

const mockReports: Report[] = [
  { id: 'rpt-1', name: 'Security Summary', type: 'security', schedule: 'daily', lastGenerated: new Date(Date.now() - 3600000), size: '2.4 MB', status: 'ready' },
  { id: 'rpt-2', name: 'Threat Analysis', type: 'security', schedule: 'weekly', lastGenerated: new Date(Date.now() - 86400000), size: '5.1 MB', status: 'ready' },
  { id: 'rpt-3', name: 'Traffic Report', type: 'traffic', schedule: 'daily', lastGenerated: new Date(Date.now() - 7200000), size: '3.8 MB', status: 'ready' },
  { id: 'rpt-4', name: 'Bandwidth Usage', type: 'traffic', schedule: 'monthly', lastGenerated: new Date(Date.now() - 604800000), size: '12.5 MB', status: 'ready' },
  { id: 'rpt-5', name: 'System Health', type: 'system', schedule: 'daily', status: 'generating' },
  { id: 'rpt-6', name: 'Compliance Audit', type: 'compliance', schedule: 'monthly', lastGenerated: new Date(Date.now() - 2592000000), size: '8.2 MB', status: 'ready' },
  { id: 'rpt-7', name: 'Firewall Rules Audit', type: 'compliance', schedule: 'weekly', status: 'scheduled' },
];

const Reports = () => {
  const [reports, setReports] = useState<Report[]>(mockReports);
  const [filter, setFilter] = useState<'all' | 'security' | 'traffic' | 'system' | 'compliance'>('all');
  const [timeRange, setTimeRange] = useState('7d');

  const filtered = reports.filter(r => filter === 'all' || r.type === filter);

  const getTypeTag = (type: string) => {
    switch (type) {
      case 'security': return 'tag-critical';
      case 'traffic': return 'tag-low';
      case 'system': return 'tag-healthy';
      case 'compliance': return 'tag-medium';
      default: return '';
    }
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'ready': return 'tag-healthy';
      case 'generating': return 'tag-medium';
      case 'scheduled': return 'tag-low';
      default: return '';
    }
  };

  const handleDownload = (report: Report) => {
    if (report.status !== 'ready') {
      toast.error('Report not ready — click Generate first');
      return;
    }
    const cache = (window as any).__reportCache?.[report.id];
    const json = cache?.data ?? JSON.stringify({
      reportName: report.name,
      type: report.type,
      generatedAt: report.lastGenerated?.toISOString() ?? new Date().toISOString(),
      period: timeRange,
      note: 'Click Generate Report to populate with live database data',
    }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded: ${report.name}`);
  };

  const handleGenerate = async (report: Report) => {
    setReports(prev => prev.map(r =>
      r.id === report.id ? { ...r, status: 'generating' as const } : r
    ));
    toast.info(`Generating ${report.name}…`);
    try {
      let data: any = { reportName: report.name, type: report.type, generatedAt: new Date().toISOString(), period: timeRange };
      if (report.type === 'security') {
        const [threats, auditLogs] = await Promise.all([
          apiFetch('/api/data/threat_events?order=created_at.desc&limit=200'),
          apiFetch('/api/data/audit_logs?order=created_at.desc&limit=200'),
        ]);
        data.threatEvents = threats;
        data.auditLogs = auditLogs;
        data.summary = { threats: threats.length, auditEntries: auditLogs.length };
      } else if (report.type === 'traffic') {
        const [rules, stats] = await Promise.all([
          apiFetch('/api/data/firewall_rules?order=hit_count.desc&limit=50'),
          apiFetch('/api/data/traffic_stats?order=recorded_at.desc&limit=100'),
        ]);
        data.firewallRules = rules;
        data.trafficStats = stats;
        data.summary = { rules: rules.length, statsRecords: stats.length };
      } else if (report.type === 'system') {
        const [metrics, settings] = await Promise.all([
          apiFetch('/api/data/system_metrics?order=recorded_at.desc&limit=48'),
          apiFetch('/api/data/system_settings'),
        ]);
        data.metrics = metrics;
        data.settings = settings;
        data.summary = { metricsRecords: metrics.length };
      } else {
        const rules = await apiFetch('/api/data/firewall_rules?limit=100');
        data.rules = rules;
        data.summary = { totalRules: rules.length };
      }
      const json = JSON.stringify(data, null, 2);
      const sizeKb = (new TextEncoder().encode(json).length / 1024);
      const size = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb.toFixed(0)} KB`;
      setReports(prev => prev.map(r =>
        r.id === report.id ? { ...r, status: 'ready' as const, lastGenerated: new Date(), size } : r
      ));
      toast.success(`${report.name} is ready — click Download`);
      // Store data for download
      (window as any).__reportCache = (window as any).__reportCache || {};
      (window as any).__reportCache[report.id] = { data: json, name: report.name };
    } catch {
      setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: 'ready' as const } : r));
      toast.error(`Failed to generate ${report.name}`);
    }
  };

  const stats = [
    { label: 'Total Reports', value: reports.length, icon: BarChart3 },
    { label: 'Ready', value: reports.filter(r => r.status === 'ready').length, icon: FileText },
    { label: 'Generating', value: reports.filter(r => r.status === 'generating').length, icon: Clock },
    { label: 'Scheduled', value: reports.filter(r => r.status === 'scheduled').length, icon: Calendar },
  ];

  const filterTabs = [
    { key: 'all' as const, label: 'All Reports' },
    { key: 'security' as const, label: 'Security' },
    { key: 'traffic' as const, label: 'Traffic' },
    { key: 'system' as const, label: 'System' },
    { key: 'compliance' as const, label: 'Compliance' },
  ];

  return (
    <Shell>
      <div className="space-y-3">
        {/* Page Header */}
        <div className="section-header-neutral">
          <div className="flex items-center gap-2">
            <BarChart3 size={14} />
            <span>Reports</span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="forti-toolbar">
          <span className="forti-label-inline mr-1">Period:</span>
          <select
            className="forti-select w-28"
            value={timeRange}
            onChange={e => setTimeRange(e.target.value)}
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <div className="forti-toolbar-separator" />
          <span className="forti-label-inline">{filtered.length} report(s)</span>
        </div>

        {/* Summary Strip */}
        <div className="summary-strip">
          {stats.map((stat, idx) => (
            <div key={idx} className="summary-item">
              <stat.icon size={16} className="text-[hsl(var(--forti-green))]" />
              <div>
                <div className="summary-count">{stat.value}</div>
                <div className="summary-label">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="forti-view-toggle">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              className={`forti-view-btn ${filter === tab.key ? 'active' : ''}`}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Reports Table */}
        <div className="section">
          <div className="section-header">
            <span>Report List</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Schedule</th>
                <th>Status</th>
                <th>Size</th>
                <th>Last Generated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((report) => (
                <tr key={report.id}>
                  <td className="font-medium">{report.name}</td>
                  <td>
                    <span className={cn("tag capitalize", getTypeTag(report.type))}>
                      {report.type}
                    </span>
                  </td>
                  <td className="capitalize">{report.schedule}</td>
                  <td>
                    <span className={cn("tag capitalize", getStatusTag(report.status))}>
                      {report.status}
                    </span>
                  </td>
                  <td>{report.size || '—'}</td>
                  <td className="text-[hsl(var(--forti-text-secondary))]">
                    {report.lastGenerated ? report.lastGenerated.toLocaleString() : '—'}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        className="forti-toolbar-btn"
                        onClick={() => handleGenerate(report)}
                        disabled={report.status === 'generating'}
                      >
                        <TrendingUp size={11} />
                        Generate
                      </button>
                      <button
                        className="forti-toolbar-btn primary"
                        onClick={() => handleDownload(report)}
                        disabled={report.status !== 'ready'}
                      >
                        <Download size={11} />
                        Download
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-[hsl(var(--forti-text-secondary))]">
                    No reports found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
};

export default Reports;
