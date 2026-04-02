import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  User,
  ChevronDown,
  LogOut,
  Key,
  ChevronRight,
  Settings,
  Terminal,
  Maximize,
  Minimize,
  HelpCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CLIConsole } from './CLIConsole';
import { HelpPanel } from './HelpPanel';

const pathToLabel: Record<string, string> = {
  '/': 'Dashboard',
  '/threats': 'Threats',
  '/incidents': 'Incidents',
  '/firewall': 'Policy & Objects',
  '/firewall/rules': 'IPv4 Policy',
  '/firewall/aliases': 'Addresses',
  '/firewall/wildcard-fqdn': 'Wildcard FQDN',
  '/firewall/services': 'Services',
  '/firewall/schedules': 'Schedules',
  '/firewall/virtual-ips': 'Virtual IPs',
  '/firewall/ip-pools': 'IP Pools',
  '/firewall/traffic-shapers': 'Traffic Shapers',
  '/firewall/traffic-shaping-policy': 'Traffic Shaping Policy',
  '/firewall/nat': 'NAT',
  '/security': 'Security Profiles',
  '/security/ids': 'IPS',
  '/security/dnsfilter': 'DNS Filter',
  '/vpn': 'VPN',
  '/vpn/ipsec': 'IPsec Tunnels',
  '/system': 'System',
  '/system/general': 'Settings',
  '/system/admins': 'Administrators',
  '/system/ha': 'High Availability',
  '/system/certificates': 'Certificates',
  '/system/users': 'User Definition',
  '/system/backup': 'Config Backup',
  '/system/full-backup': 'Full System Backup',
  '/users': 'User & Device',
  '/users/groups': 'User Groups',
  '/interfaces': 'Interfaces',
  '/routing': 'Routing',
  '/dns': 'DNS',
  '/dhcp': 'DHCP',
  '/logs': 'Log Viewer',
  '/reports': 'Reports',
  '/monitoring': 'Monitoring',
  '/monitoring/traffic': 'Traffic Analysis',
  '/monitoring/logs': 'System Logs',
};

const sectionMap: Record<string, string> = {
  firewall: 'Policy & Objects',
  security: 'Security Profiles',
  vpn: 'VPN',
  system: 'System',
  users: 'User & Device',
  monitoring: 'Monitor',
};

interface Alert {
  id: number;
  type: string;
  message: string;
  time: string;
  link: string;
}

export function Header() {
  const location = useLocation();
  const [cliOpen, setCliOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const { signOut, user } = useAuth();

  useEffect(() => { setUserMenuOpen(false); }, [location.pathname]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        toast.error('Fullscreen not supported in this browser');
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '`') { e.preventDefault(); setCliOpen(prev => !prev); }
      if (e.ctrlKey && e.key === 'h') { e.preventDefault(); setHelpOpen(prev => !prev); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleLogout = async () => { await signOut(); toast.success('Logged out successfully'); };
  const dismissAlert = (id: number) => setAlerts(prev => prev.filter(a => a.id !== id));
  const handleDismissAlert = (id: number, e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); dismissAlert(id); };
  const handleAlertClick = (alert: Alert) => { dismissAlert(alert.id); navigate(alert.link); };
  const handleClearAllAlerts = () => setAlerts([]);

  const getBreadcrumbs = () => {
    const path = location.pathname;
    if (path === '/') return [{ label: 'Dashboard', path: '/' }];
    const segments = path.split('/').filter(Boolean);
    const breadcrumbs: { label: string; path: string }[] = [];
    if (segments.length > 0) {
      const section = sectionMap[segments[0]];
      if (section) breadcrumbs.push({ label: section, path: `/${segments[0]}` });
    }
    const pageLabel = pathToLabel[path];
    if (pageLabel) breadcrumbs.push({ label: pageLabel, path });
    return breadcrumbs.length > 0 ? breadcrumbs : [{ label: 'Dashboard', path: '/' }];
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <>
      {/* ── Main header bar ── */}
      <header
        className="h-10 flex items-stretch sticky top-0 z-30 select-none"
        style={{
          background: 'linear-gradient(90deg, #155724 0%, #1e7a36 40%, #1a6b30 70%, #163d24 100%)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.45)',
        }}
      >
        {/* ── Breadcrumb + hostname ── */}
        <div className="flex items-center gap-2 px-3 flex-1 min-w-0">

          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 overflow-hidden">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.path} className="flex items-center gap-1.5 min-w-0">
                {index > 0 && <ChevronRight size={11} className="text-white/35 shrink-0" />}
                {index === breadcrumbs.length - 1 ? (
                  <span className="text-[11px] text-white font-semibold truncate">{crumb.label}</span>
                ) : (
                  <Link to={crumb.path} className="text-[11px] text-white/60 hover:text-white transition-colors truncate">
                    {crumb.label}
                  </Link>
                )}
              </div>
            ))}
          </div>

          <div className="w-px h-5 bg-white/15 ml-2" />

          {/* Hostname badge */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 cursor-default shrink-0">
                <span className="inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                <span className="text-[10px] font-mono text-white/55 tracking-wider">SONARO-GW-01</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p className="font-medium">Hostname: sonaro-gw-01</p>
              <p className="text-muted-foreground">Next-Generation Firewall — Active</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* ── Right-side tools ── */}
        <div className="flex items-center shrink-0">
          {/* Build info */}
          <div className="px-3 flex items-center">
            <span className="text-[9px] font-mono text-white/35 tracking-wider hidden md:block">build 2025.04</span>
          </div>

          <div className="w-px h-5 bg-white/15" />

          {/* CLI */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => setCliOpen(true)} className="flex items-center justify-center w-8 h-10 text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                <Terminal size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              CLI Console <kbd className="ml-1 px-1 py-0.5 bg-muted border rounded text-[9px] font-mono">Ctrl+`</kbd>
            </TooltipContent>
          </Tooltip>

          {/* Fullscreen */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={toggleFullscreen} className="flex items-center justify-center w-8 h-10 text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</TooltipContent>
          </Tooltip>

          {/* Help */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => setHelpOpen(true)} className="flex items-center justify-center w-8 h-10 text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                <HelpCircle size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Help <kbd className="ml-1 px-1 py-0.5 bg-muted border rounded text-[9px] font-mono">Ctrl+H</kbd></TooltipContent>
          </Tooltip>

          <div className="w-px h-5 bg-white/15" />

          {/* Alerts */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative flex items-center justify-center w-8 h-10 text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                <Bell size={14} />
                {alerts.length > 0 && (
                  <span className="absolute top-1.5 right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] text-white font-bold flex items-center justify-center">
                    {alerts.length}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <div className="px-3 py-2 border-b border-[#ddd] bg-[#f5f5f5] flex items-center justify-between">
                <span className="text-xs font-semibold text-[#333]">Alert Messages</span>
                {alerts.length > 0 && (
                  <button onClick={handleClearAllAlerts} className="text-[10px] text-[hsl(142,70%,35%)] hover:underline">Clear all</button>
                )}
              </div>
              {alerts.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-gray-500">No alerts</div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  {alerts.map((alert) => (
                    <div key={alert.id} onClick={() => handleAlertClick(alert)}
                      className="px-3 py-2 hover:bg-[#e8f5e9] border-b border-[#eee] last:border-b-0 flex items-start justify-between cursor-pointer transition-colors">
                      <div className="flex items-start gap-2">
                        <span className={cn("w-2 h-2 rounded-full mt-1 shrink-0",
                          alert.type === 'critical' ? "bg-red-500" : alert.type === 'high' ? "bg-orange-500" : alert.type === 'medium' ? "bg-yellow-500" : "bg-blue-500")} />
                        <div>
                          <div className="text-[11px] text-[#333]">{alert.message}</div>
                          <div className="text-[10px] text-gray-400">{alert.time}</div>
                        </div>
                      </div>
                      <button onClick={(e) => handleDismissAlert(alert.id, e)} className="text-gray-400 hover:text-red-600 text-xs ml-2 shrink-0">×</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="px-3 py-2 border-t border-[#ddd] bg-[#f5f5f5]">
                <Link to="/logs" className="text-[10px] text-[hsl(142,70%,35%)] hover:underline">View all logs →</Link>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-5 bg-white/15" />

          {/* User */}
          <div className="relative">
            <button
              data-testid="button-user-menu"
              onClick={() => setUserMenuOpen(v => !v)}
              className="flex items-center gap-2 px-3 h-10 hover:bg-white/10 transition-colors"
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-[11px] text-white select-none"
                style={{ background: '#4a5568' }}
              >
                {(user?.email?.[0] ?? 'A').toUpperCase()}
              </div>
              <span className="text-[11px] text-white font-medium hidden sm:block">
                {user?.email?.split('@')[0] || 'admin'}
              </span>
              <ChevronDown size={10} className={cn("text-white/50 transition-transform duration-150", userMenuOpen && "rotate-180")} />
            </button>

            {userMenuOpen && (
              <>
                {/* invisible backdrop to close on outside click */}
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />

                <div
                  className="absolute right-0 top-full z-50 min-w-[210px] border border-[#2a5c35] shadow-xl"
                  style={{ background: '#fff' }}
                >
                  {/* Account header — matches header gradient */}
                  <div
                    className="px-3 py-2.5 border-b border-[#2a5c35]"
                    style={{ background: 'linear-gradient(90deg, #155724 0%, #1e7a36 100%)' }}
                  >
                    <div className="text-[9px] font-mono tracking-widest text-white/45 uppercase mb-0.5">
                      Administrator
                    </div>
                    <div className="text-[11px] font-mono text-white/90">
                      {user?.email || 'admin@sonaro.local'}
                    </div>
                  </div>

                  {/* Menu items */}
                  <Link
                    to="/system/admins"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-[11px] text-[#222] hover:bg-[#f0f6f1] border-b border-[#ebebeb] transition-colors"
                  >
                    <User size={12} className="text-[#555] shrink-0" />
                    Profile
                  </Link>
                  <Link
                    to="/system/general"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-[11px] text-[#222] hover:bg-[#f0f6f1] border-b border-[#ebebeb] transition-colors"
                  >
                    <Settings size={12} className="text-[#555] shrink-0" />
                    System Settings
                  </Link>
                  <Link
                    to="/account/security"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-[11px] text-[#222] hover:bg-[#f0f6f1] border-b border-[#ebebeb] transition-colors"
                  >
                    <Key size={12} className="text-[#555] shrink-0" />
                    Account Security / MFA
                  </Link>
                  <div className="h-px bg-[#e0e0e0]" />
                  <button
                    data-testid="button-logout"
                    onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={12} className="shrink-0" />
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <CLIConsole open={cliOpen} onOpenChange={setCliOpen} />
      <HelpPanel open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}
