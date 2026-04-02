import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Shield, Terminal, Monitor, Network, Globe, Lock, 
  Server, Activity, FileText, Users 
} from 'lucide-react';

interface HelpPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const sections = [
  {
    icon: Monitor,
    title: 'Dashboard',
    desc: 'Tổng quan hệ thống: CPU, RAM, Disk, uptime, traffic và threat summary.',
  },
  {
    icon: Shield,
    title: 'Policy & Objects',
    desc: 'Quản lý Firewall Rules, Addresses, Services, Schedules, Virtual IPs, IP Pools, NAT và Traffic Shaping.',
  },
  {
    icon: Lock,
    title: 'Security Profiles',
    desc: 'Cấu hình IPS (Suricata) và DNS Filter.',
  },
  {
    icon: Globe,
    title: 'VPN',
    desc: 'Quản lý IPsec tunnels và theo dõi trạng thái kết nối VPN.',
  },
  {
    icon: Network,
    title: 'Network',
    desc: 'Cấu hình Interfaces, Routing (Static, OSPF, BGP, RIP), DNS Server, DHCP và Packet Capture.',
  },
  {
    icon: Server,
    title: 'System',
    desc: 'Cài đặt chung, quản lý Admin, High Availability, Certificates và Backup.',
  },
  {
    icon: Users,
    title: 'User & Device',
    desc: 'Quản lý user definitions và user groups.',
  },
  {
    icon: Activity,
    title: 'Monitor',
    desc: 'Traffic Analysis, System Logs, DHCP Monitor, Routing Monitor và IPsec Monitor.',
  },
  {
    icon: Terminal,
    title: 'CLI Console',
    desc: 'Command-line interface để truy vấn nhanh trạng thái hệ thống. Nhấn Ctrl+` để mở.',
  },
  {
    icon: FileText,
    title: 'Logs & Reports',
    desc: 'Xem log hệ thống, tạo báo cáo bảo mật và export dữ liệu.',
  },
];

const shortcuts = [
  { keys: ['Ctrl', '`'], action: 'Mở CLI Console' },
  { keys: ['F11'], action: 'Toàn màn hình' },
  { keys: ['Ctrl', 'H'], action: 'Mở Help' },
  { keys: ['Esc'], action: 'Đóng dialog' },
];

export function HelpPanel({ open, onOpenChange }: HelpPanelProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0 gap-0 overflow-hidden" aria-describedby={undefined}>
        <div className="px-4 py-3 border-b bg-muted/50">
          <h2 className="text-sm font-semibold">Sonaro Gate — Help Center</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Hướng dẫn sử dụng các tính năng chính</p>
        </div>
        <ScrollArea className="h-[60vh]">
          <div className="p-4 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Modules</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {sections.map(s => (
                  <div key={s.title} className="flex items-start gap-2.5 p-2.5 rounded-md border bg-card hover:bg-accent/50 transition-colors">
                    <s.icon size={16} className="text-primary mt-0.5 shrink-0" />
                    <div>
                      <div className="text-[12px] font-medium">{s.title}</div>
                      <div className="text-[11px] text-muted-foreground leading-relaxed">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Keyboard Shortcuts</h3>
              <div className="space-y-1.5">
                {shortcuts.map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] py-1 px-2 rounded bg-muted/30">
                    <div className="flex items-center gap-1">
                      {s.keys.map((k, j) => (
                        <span key={j}>
                          <kbd className="px-1.5 py-0.5 bg-muted border rounded text-[10px] font-mono">{k}</kbd>
                          {j < s.keys.length - 1 && <span className="text-muted-foreground mx-0.5">+</span>}
                        </span>
                      ))}
                    </div>
                    <span className="text-muted-foreground">{s.action}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-[10px] text-muted-foreground text-center pt-2 border-t">
              Sonaro Gate 2025.1 LTS — © 2026 Sonaro Security
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
