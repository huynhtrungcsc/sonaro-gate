import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { Download, ChevronRight, RefreshCw, Search } from 'lucide-react';
import { useThreatEvents } from '@/hooks/useDbData';
import { useQueryClient } from '@tanstack/react-query';

const ThreatMonitor = () => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  const { data: threats = [], isLoading } = useThreatEvents(500);

  const severities = ['all', 'critical', 'high', 'medium', 'low'];

  const filteredThreats = threats.filter(t => {
    const matchesSev = selectedSeverity === 'all' || t.severity === selectedSeverity;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || (
      (t.signature ?? '').toLowerCase().includes(q) ||
      (t.category ?? '').toLowerCase().includes(q) ||
      (t.source_ip ?? '').toLowerCase().includes(q) ||
      (t.destination_ip ?? '').toLowerCase().includes(q)
    );
    return matchesSev && matchesSearch;
  });

  const counts = {
    critical: threats.filter(t => t.severity === 'critical').length,
    high: threats.filter(t => t.severity === 'high').length,
    medium: threats.filter(t => t.severity === 'medium').length,
    low: threats.filter(t => t.severity === 'low').length,
  };

  const formatTime = (isoStr: string) => {
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  const handleExport = () => {
    const csv = ['Severity,Signature,Category,Source,Destination,Action,Time']
      .concat(filteredThreats.map(t =>
        `${t.severity},${t.signature ?? ''},${t.category ?? ''},${t.source_ip ?? ''}:${t.source_port ?? ''},${t.destination_ip ?? ''}:${t.destination_port ?? ''},${t.action},${t.created_at}`
      )).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threats-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Shell>
      <div className="space-y-0">
        <div className="section-header-neutral">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Threat Monitor</span>
            <span className="text-[10px] text-[#888]">Real-time threat detection and analysis</span>
          </div>
        </div>

        <div className="forti-toolbar">
          <button className="forti-toolbar-btn" onClick={() => queryClient.invalidateQueries({ queryKey: ['threat-events'] })}>
            <RefreshCw size={12} />
            <span>Refresh</span>
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={handleExport}>
            <Download size={12} />
            <span>Export Log</span>
          </button>
          <div className="flex-1" />
          <div className="forti-search">
            <Search size={12} className="text-[#999]" />
            <input
              type="text"
              placeholder="Search threats..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 bg-[#f0f0f0] border border-[#ddd] border-t-0">
          <span className="text-[11px] text-[#666] font-medium">Severity:</span>
          <div className="flex items-center gap-0.5">
            {severities.map((sev) => (
              <button
                key={sev}
                onClick={() => setSelectedSeverity(sev)}
                className={cn(
                  "px-3 py-1 text-[11px] font-medium border transition-colors capitalize",
                  selectedSeverity === sev
                    ? "bg-[hsl(142,70%,35%)] text-white border-[hsl(142,75%,28%)]"
                    : "bg-white text-[#666] border-[#ccc] hover:bg-[#f5f5f5]"
                )}
              >
                {sev === 'all' ? `All (${threats.length})` : `${sev} (${counts[sev as keyof typeof counts] ?? 0})`}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <span className="text-[11px] text-[#666]">
            {isLoading ? 'Loading…' : `Showing ${filteredThreats.length} of ${threats.length} events`}
          </span>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th className="w-20">Severity</th>
              <th>Signature</th>
              <th className="w-24">Category</th>
              <th className="w-36">Source</th>
              <th className="w-36">Destination</th>
              <th className="w-20">Action</th>
              <th className="w-16">Time</th>
              <th className="w-16"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-[#999] text-[11px]">Loading threat events…</td>
              </tr>
            )}
            {!isLoading && filteredThreats.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-[#999] text-[11px]">No threat events found</td>
              </tr>
            )}
            {filteredThreats.map((threat) => (
              <tr key={threat.id}>
                <td>
                  <span className={cn(
                    "forti-tag inline-block min-w-[80px] text-center",
                    threat.severity === 'critical' ? 'bg-red-100 text-red-700 border-red-200' :
                    threat.severity === 'high' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                    threat.severity === 'medium' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                    'bg-blue-100 text-blue-700 border-blue-200'
                  )}>
                    {threat.severity?.toUpperCase()}
                  </span>
                </td>
                <td className="font-medium text-[#333]">{threat.signature ?? '—'}</td>
                <td className="text-[#666]">{threat.category ?? '—'}</td>
                <td className="font-mono text-[11px] text-[#666]">
                  {threat.source_ip ?? '—'}{threat.source_port ? `:${threat.source_port}` : ''}
                </td>
                <td className="font-mono text-[11px] text-[#666]">
                  {threat.destination_ip ?? '—'}{threat.destination_port ? `:${threat.destination_port}` : ''}
                </td>
                <td>
                  <span className={cn(
                    "forti-tag inline-block min-w-[80px] text-center",
                    threat.action === 'blocked'
                      ? 'bg-green-100 text-green-700 border-green-200'
                      : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                  )}>
                    {threat.action?.toUpperCase()}
                  </span>
                </td>
                <td className="text-[#666] text-[10px]">{formatTime(threat.created_at)}</td>
                <td>
                  <Link
                    to={`/threats/${threat.id}`}
                    className="text-[hsl(142,70%,35%)] hover:underline inline-flex items-center gap-0.5 text-[11px]"
                  >
                    Details
                    <ChevronRight size={10} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
};

export default ThreatMonitor;
