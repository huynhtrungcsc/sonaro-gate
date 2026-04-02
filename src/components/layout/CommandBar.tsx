import { useState, useEffect } from 'react';
import { Bell, User } from 'lucide-react';

export function CommandBar() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="command-bar">
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="status-dot-lg status-healthy" />
          <span className="font-medium text-foreground">PRIMARY</span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">Online</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-4 text-muted-foreground">
          <span>Uptime: <span className="text-foreground font-medium">30d 5h</span></span>
          <span>Sessions: <span className="text-foreground font-medium">12,847</span></span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-status-critical/15 text-status-critical hover:bg-status-critical/25 transition-colors">
          <Bell size={14} />
          <span className="font-semibold">3 Alerts</span>
        </button>
        <div className="h-4 w-px bg-border" />
        <span className="text-sm text-muted-foreground mono">
          {currentTime.toLocaleTimeString('en-US', { hour12: false })}
        </span>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-7 h-7 rounded-sm bg-muted flex items-center justify-center">
            <User size={14} className="text-muted-foreground" />
          </div>
          <span className="font-medium">admin</span>
        </div>
      </div>
    </header>
  );
}
