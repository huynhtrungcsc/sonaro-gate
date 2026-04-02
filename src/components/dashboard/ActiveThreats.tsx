import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRecentThreats } from '@/hooks/useDashboardData';

export function ActiveThreats() {
  const { data: threatEvents = [] } = useRecentThreats();
  const recentThreats = threatEvents.slice(0, 5);

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="panel h-full">
      <div className="panel-header">
        <span>Active Threats</span>
        <Link to="/threats" className="text-xs text-primary hover:underline flex items-center gap-1">
          View All <ChevronRight size={12} />
        </Link>
      </div>
      <div className="divide-y divide-border">
        {recentThreats.length > 0 ? recentThreats.map((threat) => (
          <Link
            key={threat.id}
            to={`/threats/${threat.id}`}
            className="block px-4 py-3 hover:bg-accent/50 cursor-pointer transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <span className={cn(
                  "tag mt-0.5",
                  threat.severity === 'critical' ? 'tag-critical' :
                  threat.severity === 'high' ? 'tag-high' : 'tag-medium'
                )}>
                  {threat.severity.toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="font-medium text-sm">{threat.category}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">
                    {threat.source_ip ?? '—'} → {threat.destination_ip ?? '—'}:{threat.destination_port ?? ''}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-muted-foreground">{formatTime(threat.created_at)}</div>
                <div className={cn(
                  "text-xs mt-0.5",
                  threat.action === 'blocked' ? 'text-status-healthy' : 'text-status-medium'
                )}>
                  {threat.action.toUpperCase()}
                </div>
              </div>
            </div>
            {threat.ai_confidence && (
              <div className="mt-2 text-xs text-muted-foreground">
                AI Confidence: <span className="text-foreground">{threat.ai_confidence}%</span>
              </div>
            )}
          </Link>
        )) : (
          <div className="p-4 text-sm text-muted-foreground text-center">No recent threats detected</div>
        )}
      </div>
    </div>
  );
}
