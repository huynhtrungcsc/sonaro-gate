import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRecentThreats } from '@/hooks/useDashboardData';

export function SecurityPosture() {
  const { data: threats = [] } = useRecentThreats();
  
  const criticalCount = threats.filter(t => t.severity === 'critical').length;
  const highCount = threats.filter(t => t.severity === 'high').length;
  const totalActive = threats.length;

  const riskLevel = criticalCount > 0 ? 'HIGH' : highCount > 0 ? 'MEDIUM' : totalActive > 0 ? 'LOW' : 'SAFE';
  const riskColor = criticalCount > 0 ? 'text-status-critical' : highCount > 0 ? 'text-status-high' : 'text-status-healthy';
  const ringColor = criticalCount > 0 ? 'stroke-status-critical' : highCount > 0 ? 'stroke-status-high' : 'stroke-status-healthy';

  const circumference = 2 * Math.PI * 42;
  const riskScore = criticalCount > 0 ? 75 : highCount > 0 ? 50 : totalActive > 0 ? 25 : 5;
  const strokeDashoffset = circumference - (riskScore / 100) * circumference;

  return (
    <div className="panel h-full">
      <div className="panel-header"><span>Security Posture</span></div>
      <div className="panel-body flex flex-col items-center">
        <div className="relative my-4">
          <svg width="100" height="100" className="-rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
            <circle cx="50" cy="50" r="42" fill="none" className={ringColor} strokeWidth="6"
              strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("text-xl font-semibold", riskColor)}>{riskLevel}</span>
            <span className="text-[10px] text-muted-foreground">Risk Level</span>
          </div>
        </div>
        <div className="w-full space-y-2 mt-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Active Events (24h)</span>
            <span className="font-medium">{totalActive}</span>
          </div>
          <div className="space-y-1">
            {criticalCount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="status-indicator status-critical" />
                  <span>Critical</span>
                </div>
                <span className="font-medium">{criticalCount}</span>
              </div>
            )}
            {highCount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="status-indicator status-high" />
                  <span>High</span>
                </div>
                <span className="font-medium">{highCount}</span>
              </div>
            )}
          </div>
        </div>
        <Link to="/threats" className="flex items-center gap-1 text-xs text-primary hover:underline mt-4">
          View Events <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  );
}
