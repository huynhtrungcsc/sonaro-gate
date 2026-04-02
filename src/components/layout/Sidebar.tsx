import { Link, useLocation } from 'react-router-dom';
import bugLogoSrc from '@/assets/bug-logo.png';
import { cn } from '@/lib/utils';
import {
  FgDashboard,
  FgFortiView,
  FgNetwork,
  FgRouting,
  FgPolicyObjects,
  FgTrafficShaping,
  FgSecurityProfiles,
  FgVPN,
  FgUserDevice,
  FgLogReport,
  FgSystem,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from '@/components/layout/FortiIcons';
import { useState, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  label: string;
  path: string;
}

type IconComponent = React.FC<React.SVGProps<SVGSVGElement> & { size?: number }>;

interface NavSection {
  title: string;
  icon: IconComponent;
  items: NavItem[];
  defaultOpen?: boolean;
  directPath?: string;
}

const navigation: NavSection[] = [
  // ── 1. Dashboard ──────────────────────────────────────────
  {
    title: 'Dashboard',
    icon: FgDashboard,
    directPath: '/',
    items: [],
  },

  // ── 2. Monitor ────────────────────────────────────────────
  {
    title: 'Monitor',
    icon: FgFortiView,
    defaultOpen: false,
    items: [
      { label: 'Traffic Analysis', path: '/monitoring/traffic' },
      { label: 'Threats', path: '/threats' },
      { label: 'Incidents', path: '/incidents' },
    ],
  },

  // ── 4. Network ────────────────────────────────────────────
  {
    title: 'Network',
    icon: FgNetwork,
    defaultOpen: false,
    items: [
      { label: 'Interfaces', path: '/interfaces' },
      { label: 'Interface Assignment', path: '/interfaces/assignment' },
      { label: 'DNS Server', path: '/dns' },
      { label: 'DHCP Server', path: '/dhcp' },
      { label: 'Packet Capture', path: '/packet-capture' },
    ],
  },

  // ── 3. Routing ────────────────────────────────────────────
  {
    title: 'Routing',
    icon: FgRouting,
    defaultOpen: false,
    items: [
      { label: 'Static Routes', path: '/routing/static' },
      { label: 'Policy Routes', path: '/routing/policy' },
      { label: 'RIP', path: '/routing/rip' },
      { label: 'OSPF', path: '/routing/ospf' },
      { label: 'BGP', path: '/routing/bgp' },
    ],
  },

  // ── 4. Policy & Objects ───────────────────────────────────
  {
    title: 'Policy & Objects',
    icon: FgPolicyObjects,
    defaultOpen: true,
    items: [
      { label: 'IPv4 Policy', path: '/firewall/rules' },
      { label: 'NAT', path: '/firewall/nat' },
      { label: 'Addresses', path: '/firewall/aliases' },
      { label: 'Wildcard FQDN', path: '/firewall/wildcard-fqdn' },
      { label: 'Services', path: '/firewall/services' },
      { label: 'Schedules', path: '/firewall/schedules' },
      { label: 'Virtual IPs', path: '/firewall/virtual-ips' },
      { label: 'IP Pools', path: '/firewall/ip-pools' },
    ],
  },

  // ── 5. Traffic Shaping ────────────────────────────────────
  {
    title: 'Traffic Shaping',
    icon: FgTrafficShaping,
    defaultOpen: false,
    items: [
      { label: 'Traffic Shapers', path: '/firewall/traffic-shapers' },
      { label: 'Shaping Policy', path: '/firewall/traffic-shaping-policy' },
    ],
  },

  // ── 6. Security Profiles ──────────────────────────────────
  {
    title: 'Security Profiles',
    icon: FgSecurityProfiles,
    defaultOpen: false,
    items: [
      { label: 'IPS', path: '/security/ids' },
      { label: 'DNS Filter', path: '/security/dnsfilter' },
    ],
  },

  // ── 7. VPN ────────────────────────────────────────────────
  {
    title: 'VPN',
    icon: FgVPN,
    defaultOpen: false,
    items: [
      { label: 'IPsec Tunnels', path: '/vpn/ipsec' },
      { label: 'WireGuard', path: '/vpn/wireguard' },
      { label: 'VPN Monitor', path: '/vpn/monitor' },
    ],
  },

  // ── 8. User & Device ──────────────────────────────────────
  {
    title: 'User & Device',
    icon: FgUserDevice,
    defaultOpen: false,
    items: [
      { label: 'Local Users',          path: '/users/local' },
      { label: 'User Groups',          path: '/users/groups' },
      { label: 'Authentication Servers', path: '/users/auth-servers' },
    ],
  },

  // ── 10. Log & Report ──────────────────────────────────────
  {
    title: 'Log & Report',
    icon: FgLogReport,
    defaultOpen: false,
    items: [
      { label: 'Event Logs', path: '/logs' },
      { label: 'System Logs', path: '/monitoring/logs' },
      { label: 'Reports', path: '/reports' },
    ],
  },

  // ── 11. System ────────────────────────────────────────────
  {
    title: 'System',
    icon: FgSystem,
    defaultOpen: false,
    items: [
      { label: 'General Settings', path: '/system/general' },
      { label: 'Administrators', path: '/system/admins' },
      { label: 'Certificates', path: '/system/certificates' },
      { label: 'High Availability', path: '/system/ha' },
      { label: 'Config Backup', path: '/system/backup' },
      { label: 'Full System Backup', path: '/system/full-backup' },
    ],
  },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();

  const getInitialExpanded = () => {
    const defaultExpanded = navigation.filter(s => s.defaultOpen).map(s => s.title);
    navigation.forEach(section => {
      if (section.items.some(item =>
        location.pathname === item.path ||
        location.pathname.startsWith(item.path.split('/').slice(0, 2).join('/'))
      )) {
        if (!defaultExpanded.includes(section.title)) {
          defaultExpanded.push(section.title);
        }
      }
    });
    return defaultExpanded;
  };

  const [expandedSections, setExpandedSections] = useState<string[]>(getInitialExpanded);

  useEffect(() => {
    navigation.forEach(section => {
      const hasActiveItem = section.items.some(item =>
        location.pathname === item.path || location.pathname.startsWith(item.path + '/')
      );
      if (hasActiveItem && !expandedSections.includes(section.title)) {
        setExpandedSections(prev => [...prev, section.title]);
      }
    });
  }, [location.pathname]);

  const toggleSection = (title: string) => {
    setExpandedSections(prev =>
      prev.includes(title)
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
  };

  const isActive = (path: string) => location.pathname === path;
  const isSectionActive = (section: NavSection) =>
    (section.directPath != null && section.directPath === location.pathname) ||
    section.items.some(item =>
      location.pathname === item.path || location.pathname.startsWith(item.path + '/')
    );

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen flex flex-col z-40 transition-all duration-300',
        collapsed ? 'w-[48px]' : 'w-[200px]'
      )}
      style={{ background: '#1e2d3d' }}
    >
      {/* Logo area — click → Dashboard */}
      {!collapsed ? (
        <Link
          to="/"
          className="h-10 flex items-center gap-2 px-3 border-b border-[#16232f] shrink-0 cursor-pointer hover:brightness-110 transition-[filter] duration-150"
          style={{ background: 'linear-gradient(180deg, #0d2a14 0%, #112415 100%)' }}
          title="Go to Dashboard"
        >
          <div className="flex items-center justify-center w-6 h-6 rounded shrink-0"
            style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.28)' }}>
            <img src={bugLogoSrc} alt="Sonaro Gate" className="w-4 h-4" />
          </div>
          <div className="flex flex-col leading-none gap-0.5">
            <div className="flex items-baseline gap-1">
              <span className="text-white font-extrabold text-[12px] tracking-wide">SONARO</span>
              <span className="text-[12px] font-extrabold tracking-wide" style={{ color: '#4ade80' }}>GATE</span>
            </div>
            <span className="text-[8px] font-mono tracking-widest" style={{ color: 'rgba(74,222,128,0.6)' }}>2025.1 LTS</span>
          </div>
        </Link>
      ) : (
        <Link
          to="/"
          className="h-10 flex items-center justify-center border-b border-[#16232f] shrink-0 cursor-pointer hover:brightness-110 transition-[filter] duration-150"
          style={{ background: 'linear-gradient(180deg, #0d2a14 0%, #112415 100%)' }}
          title="Go to Dashboard"
        >
          <div className="flex items-center justify-center w-6 h-6 rounded"
            style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.28)' }}>
            <img src={bugLogoSrc} alt="Sonaro Gate" className="w-4 h-4" />
          </div>
        </Link>
      )}

      <nav className="flex-1 overflow-y-auto py-1">
        {navigation.map((section) => {
          const isExpanded = expandedSections.includes(section.title);
          const hasActiveItem = isSectionActive(section);
          const SectionIcon = section.icon;

          /* ── Direct-link section (Dashboard) ── */
          if (section.directPath) {
            const linkEl = (
              <Link
                key={section.title}
                to={section.directPath}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors border-l-2',
                  collapsed && 'justify-center px-0',
                  isActive(section.directPath)
                    ? 'bg-[#4caf50] text-white border-[#4caf50]'
                    : 'text-gray-300 hover:bg-[#2a3f54] hover:text-white border-transparent'
                )}
              >
                <SectionIcon size={14} className="shrink-0" />
                {!collapsed && <span>{section.title}</span>}
              </Link>
            );
            if (collapsed) {
              return (
                <Tooltip key={section.title}>
                  <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">{section.title}</TooltipContent>
                </Tooltip>
              );
            }
            return linkEl;
          }

          /* ── Collapsible section ── */
          const sectionBtn = (
            <button
              onClick={() => (collapsed ? onToggle() : toggleSection(section.title))}
              className={cn(
                'w-full flex items-center justify-between px-3 py-1.5 text-[11px] transition-colors border-l-2',
                collapsed && 'justify-center px-0',
                hasActiveItem
                  ? 'text-[#4caf50] border-[#4caf50]'
                  : 'text-gray-300 hover:text-white border-transparent'
              )}
            >
              <div className="flex items-center gap-2">
                <SectionIcon size={14} className="shrink-0" />
                {!collapsed && <span>{section.title}</span>}
              </div>
              {!collapsed && (
                isExpanded
                  ? <ChevronDown size={10} className="text-gray-500" />
                  : <ChevronRight size={10} className="text-gray-500" />
              )}
            </button>
          );

          return (
            <div key={section.title}>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>{sectionBtn}</TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">{section.title}</TooltipContent>
                </Tooltip>
              ) : sectionBtn}

              {!collapsed && section.items.length > 0 && (
                <ul
                  className={cn(
                    'bg-[#16232f] overflow-hidden transition-all duration-300 ease-out',
                    isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
                  )}
                >
                  {section.items.map((item, index) => (
                    <li
                      key={item.path + item.label}
                      className={cn(
                        'transition-all duration-200',
                        isExpanded ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0'
                      )}
                      style={{ transitionDelay: isExpanded ? `${index * 25}ms` : '0ms' }}
                    >
                      <Link
                        to={item.path}
                        className={cn(
                          'flex items-center pl-8 pr-3 py-1 text-[11px] transition-colors',
                          isActive(item.path)
                            ? 'bg-[#4caf50] text-white'
                            : 'text-gray-400 hover:text-white hover:bg-[#1e2d3d]'
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-2 py-2 border-t border-[#16232f]">
        <button
          onClick={onToggle}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-1.5 text-gray-400 hover:text-white hover:bg-[#2a3f54] rounded transition-colors text-[11px]',
            collapsed && 'justify-center'
          )}
        >
          {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
