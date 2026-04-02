import { useState } from 'react';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { 
  BarChart3, Download, Calendar, FileText, Clock,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';

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
  const [reports, setReports] = useState<Report[]>([]);
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
      toast.error('Report not ready for download');
      return;
    }
    // Generate a realistic report file
    const content = {
      reportName: report.name,
      type: report.type,
      generatedAt: report.lastGenerated?.toISOString(),
      period: timeRange,
      summary: `${report.name} — auto-generated report`,
      data: Array.from({ length: 20 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 3600000).toISOString(),
        metric: Math.round(Math.random() * 1000),
        status: ['ok', 'warning', 'critical'][Math.floor(Math.random() * 3)],
      })),
    };
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${report.name}`);
  };

  const handleGenerate = (report: Report) => {
    setReports(prev => prev.map(r =>
      r.id === report.id ? { ...r, status: 'generating' as const } : r
    ));
    toast.info(`Generating ${report.name}...`);
    setTimeout(() => {
      setReports(prev => prev.map(r =>
        r.id === report.id
          ? { ...r, status: 'ready' as const, lastGenerated: new Date(), size: `${(Math.random() * 10 + 1).toFixed(1)} MB` }
          : r
      ));
      toast.success(`${report.name} is ready`);
    }, 2500);
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
