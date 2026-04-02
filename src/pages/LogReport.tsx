import { useState } from 'react';
import { useAuditLogs } from '@/hooks/useDbData';
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
  ChevronDown
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'traffic' | 'event' | 'security' | 'system';
  level: 'info' | 'warning' | 'error' | 'critical';
  source: string;
  message: string;
  details?: string;
}


const LogReport = () => {
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState('today');
  const { data: rawLogs = [] } = useAuditLogs(500);

  const logTypes = [
    { value: 'all', label: 'All Types', icon: FileText },
    { value: 'traffic', label: 'Traffic', icon: Globe },
    { value: 'security', label: 'Security', icon: Shield },
    { value: 'event', label: 'Events', icon: AlertTriangle },
    { value: 'system', label: 'System', icon: Server },
  ];

  const logLevels = ['all', 'info', 'warning', 'error', 'critical'];

  const logs = (rawLogs as any[]).map((l: any) => ({
    id: l.id,
    timestamp: new Date(l.created_at),
    type: l.resource_type === 'firewall_rules' || l.resource_type === 'nat_rules' ? 'security' : l.resource_type === 'network_interfaces' ? 'traffic' : l.resource_type === 'system' ? 'system' : 'event',
    level: l.action?.startsWith('DELETE') ? 'warning' : l.action?.includes('error') ? 'error' : 'info',
    source: l.ip_address || 'system',
    message: `${l.action} ${l.resource_type ? `[${l.resource_type}]` : ''}${l.resource_id ? ` #${l.resource_id}` : ''}`,
    details: l.details,
  }));

  const filteredLogs = logs.filter(log => {
    if (selectedType !== 'all' && log.type !== selectedType) return false;
    if (selectedLevel !== 'all' && log.level !== selectedLevel) return false;
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getLevelStyle = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'error': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'warning': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'traffic': return <Globe size={12} className="text-blue-500" />;
      case 'security': return <Shield size={12} className="text-red-500" />;
      case 'event': return <AlertTriangle size={12} className="text-yellow-500" />;
      case 'system': return <Server size={12} className="text-gray-500" />;
      default: return <FileText size={12} className="text-gray-500" />;
    }
  };

  const escapeCSV = (value: string) => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    if (format === 'csv') {
      const csv = ['Timestamp,Type,Level,Source,Message,Details']
        .concat(filteredLogs.map(log => 
          [
            log.timestamp.toISOString(),
            log.type,
            log.level,
            escapeCSV(log.source),
            escapeCSV(log.message),
            escapeCSV(log.details || ''),
          ].join(',')
        )).join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${filteredLogs.length} log entries to CSV`);
    }
  };

  // Stats
  const stats = {
    total: logs.length,
    critical: logs.filter(l => l.level === 'critical').length,
    errors: logs.filter(l => l.level === 'error').length,
    warnings: logs.filter(l => l.level === 'warning').length,
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
          <button className="forti-toolbar-btn" onClick={() => window.location.reload()}>
            <RefreshCw size={12} />
            <span>Refresh</span>
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={() => handleExport('csv')}>
            <Download size={12} />
            <span>Export CSV</span>
          </button>
          <button className="forti-toolbar-btn" onClick={() => toast.info('PDF export is not available in demo mode')}>
            <Download size={12} />
            <span>Export PDF</span>
          </button>
          <div className="forti-toolbar-separator" />
          <div className="flex items-center gap-1">
            <Calendar size={12} className="text-[#666]" />
            <select 
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="forti-select"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>
          <div className="flex-1" />
          <div className="forti-search">
            <Search size={12} className="text-[#999]" />
            <input 
              type="text" 
              placeholder="Search logs..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Stats Bar */}
        <StatsBar items={[
          { value: stats.total, label: 'Total Logs' },
          { value: stats.critical, label: 'Critical', color: 'text-red-600' },
          { value: stats.errors, label: 'Errors', color: 'text-orange-600' },
          { value: stats.warnings, label: 'Warnings', color: 'text-yellow-600' },
        ]} />

        {/* Tabs */}
        <Tabs defaultValue="logs" className="w-full">
          <div className="bg-[#f0f0f0] border-x border-b border-[#ddd]">
            <TabsList className="bg-transparent h-auto p-0 rounded-none">
              <TabsTrigger 
                value="logs" 
                className="data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-b-[hsl(142,70%,35%)] rounded-none px-4 py-2 text-[11px]"
              >
                Log Viewer
              </TabsTrigger>
              <TabsTrigger 
                value="reports" 
                className="data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-b-[hsl(142,70%,35%)] rounded-none px-4 py-2 text-[11px]"
              >
                Reports
              </TabsTrigger>
              <TabsTrigger 
                value="settings" 
                className="data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-b-[hsl(142,70%,35%)] rounded-none px-4 py-2 text-[11px]"
              >
                Log Settings
              </TabsTrigger>
            </TabsList>
          </div>

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
                      "px-2 py-1 text-[11px] font-medium border transition-colors flex items-center gap-1",
                      selectedType === type.value 
                        ? "bg-[hsl(142,70%,35%)] text-white border-[hsl(142,75%,28%)]" 
                        : "bg-white text-[#666] border-[#ccc] hover:bg-[#f5f5f5]"
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
                      "px-2 py-1 text-[11px] font-medium border transition-colors capitalize",
                      selectedLevel === level 
                        ? "bg-[hsl(142,70%,35%)] text-white border-[hsl(142,75%,28%)]" 
                        : "bg-white text-[#666] border-[#ccc] hover:bg-[#f5f5f5]"
                    )}
                  >
                    {level === 'all' ? 'All' : level}
                  </button>
                ))}
              </div>
              <div className="flex-1" />
              <span className="text-[11px] text-[#666]">{filteredLogs.length} entries</span>
            </div>

            {/* Log Table */}
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-24">Date</th>
                  <th className="w-20">Time</th>
                  <th className="w-20">Type</th>
                  <th className="w-20">Level</th>
                  <th className="w-20">Source</th>
                  <th>Message</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
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
                      <span className={cn("forti-tag", getLevelStyle(log.level))}>
                        {log.level.toUpperCase()}
                      </span>
                    </td>
                    <td className="text-[#666]">{log.source}</td>
                    <td className="font-medium text-[#333]">{log.message}</td>
                    <td className="text-[#888]">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>

          <TabsContent value="reports" className="mt-0 p-4 bg-white border-x border-b border-[#ddd]">
            <div className="grid grid-cols-3 gap-4">
              {/* Report Cards */}
              <div className="border border-[#ddd] bg-white">
                <div className="section-header">
                  <span>Traffic Report</span>
                </div>
                <div className="p-3 space-y-2">
                  <p className="text-[11px] text-[#666]">Summary of all traffic logs including bandwidth usage and top destinations.</p>
                  <button className="forti-btn forti-btn-primary w-full">
                    <Download size={12} className="mr-1" />
                    Generate Report
                  </button>
                </div>
              </div>
              <div className="border border-[#ddd] bg-white">
                <div className="section-header">
                  <span>Security Report</span>
                </div>
                <div className="p-3 space-y-2">
                  <p className="text-[11px] text-[#666]">Security events, blocked threats, and IPS/AV activity summary.</p>
                  <button className="forti-btn forti-btn-primary w-full">
                    <Download size={12} className="mr-1" />
                    Generate Report
                  </button>
                </div>
              </div>
              <div className="border border-[#ddd] bg-white">
                <div className="section-header">
                  <span>System Report</span>
                </div>
                <div className="p-3 space-y-2">
                  <p className="text-[11px] text-[#666]">System health, resource usage, and configuration changes.</p>
                  <button className="forti-btn forti-btn-primary w-full">
                    <Download size={12} className="mr-1" />
                    Generate Report
                  </button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-0 p-4 bg-white border-x border-b border-[#ddd]">
            <div className="space-y-4">
              <div className="section">
                <div className="section-header-neutral">
                  <span>Log Storage Settings</span>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="forti-label">Log Retention (Days)</label>
                      <input type="number" className="forti-input w-full" defaultValue={30} />
                    </div>
                    <div>
                      <label className="forti-label">Max Storage (GB)</label>
                      <input type="number" className="forti-input w-full" defaultValue={10} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="forti-label">Remote Syslog Server</label>
                      <input type="text" className="forti-input w-full" placeholder="192.168.1.100" />
                    </div>
                    <div>
                      <label className="forti-label">Syslog Port</label>
                      <input type="number" className="forti-input w-full" defaultValue={514} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button className="forti-btn forti-btn-secondary">Cancel</button>
                <button className="forti-btn forti-btn-primary">Apply</button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Shell>
  );
};

export default LogReport;
