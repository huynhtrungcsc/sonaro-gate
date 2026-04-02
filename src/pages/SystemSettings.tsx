import { useState, useEffect } from 'react';
import { useSystemSettings } from '@/hooks/useDbData';
import { systemSettingsApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { FortiToggle } from '@/components/ui/forti-toggle';
import { 
  Settings, 
  Save,
  Server,
  Clock,
  Globe,
  Bell,
  Shield,
  Users,
  Database,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

const SystemSettings = () => {
  const queryClient = useQueryClient();
  const { data: dbSettings = [] } = useSystemSettings();
  const [hostname, setHostname] = useState('SONARO-GATE');
  const [domain, setDomain] = useState('local.lan');
  const [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh');
  const [ntpServer, setNtpServer] = useState('pool.ntp.org');
  const [dnsServers, setDnsServers] = useState('8.8.8.8, 1.1.1.1');
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [syslogEnabled, setSyslogEnabled] = useState(true);
  const [syslogServer, setSyslogServer] = useState('192.168.1.100');
  const [webGuiPort, setWebGuiPort] = useState('443');
  const [sshEnabled, setSshEnabled] = useState(true);
  const [sshPort, setSshPort] = useState('22');
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [activeTab, setActiveTab] = useState<'general' | 'network' | 'admin' | 'notifications'>('general');

  useEffect(() => {
    if (!dbSettings || (dbSettings as any[]).length === 0) return;
    const get = (key: string) => (dbSettings as any[]).find((s: any) => s.key === key)?.value;
    if (get('hostname')) setHostname(get('hostname'));
    if (get('domain')) setDomain(get('domain'));
    if (get('timezone')) setTimezone(get('timezone'));
    if (get('ntp_server')) setNtpServer(get('ntp_server'));
    if (get('dns_servers')) setDnsServers(get('dns_servers'));
    if (get('auto_update')) setAutoUpdate(get('auto_update') === 'true');
    if (get('syslog_enabled')) setSyslogEnabled(get('syslog_enabled') === 'true');
    if (get('syslog_server')) setSyslogServer(get('syslog_server'));
    if (get('webgui_port')) setWebGuiPort(get('webgui_port'));
    if (get('ssh_enabled')) setSshEnabled(get('ssh_enabled') === 'true');
    if (get('ssh_port')) setSshPort(get('ssh_port'));
    if (get('session_timeout')) setSessionTimeout(get('session_timeout'));
  }, [dbSettings]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const settings = [
        ['hostname', hostname], ['domain', domain], ['timezone', timezone],
        ['ntp_server', ntpServer], ['dns_servers', dnsServers], ['auto_update', String(autoUpdate)],
        ['syslog_enabled', String(syslogEnabled)], ['syslog_server', syslogServer],
        ['webgui_port', webGuiPort], ['ssh_enabled', String(sshEnabled)],
        ['ssh_port', sshPort], ['session_timeout', sessionTimeout],
      ];
      for (const [key, value] of settings) {
        await systemSettingsApi.upsert(key, value);
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['system-settings'] }); toast.success('Settings saved successfully'); },
    onError: () => toast.error('Failed to save settings'),
  });

  const handleSave = () => saveMut.mutate();

  const handleReboot = () => {
    toast.success('System reboot scheduled');
  };

  const notificationSettings = [
    { label: 'Critical Security Alerts', enabled: true },
    { label: 'System Health Warnings', enabled: true },
    { label: 'Daily Summary Reports', enabled: false },
    { label: 'Configuration Changes', enabled: true },
    { label: 'VPN Connection Events', enabled: false },
  ];

  const [notifications, setNotifications] = useState(notificationSettings);

  const toggleNotification = (index: number) => {
    setNotifications(prev => prev.map((n, i) => 
      i === index ? { ...n, enabled: !n.enabled } : n
    ));
  };

  return (
    <Shell>
      <div className="space-y-0 animate-slide-in">
        {/* FortiGate Toolbar */}
        <div className="forti-toolbar">
          <button onClick={handleSave} className="forti-toolbar-btn primary">
            <Save className="w-3 h-3" />
            Save Changes
          </button>
          <button onClick={handleReboot} className="forti-toolbar-btn">
            <RefreshCw className="w-3 h-3" />
            Reboot
          </button>
          <div className="flex-1" />
        </div>

        {/* Tabs */}
        <div className="flex items-center bg-[#e8e8e8] border-b border-[#ccc]">
          {[
            { id: 'general', label: 'General', icon: Server },
            { id: 'network', label: 'Network', icon: Globe },
            { id: 'admin', label: 'Administration', icon: Users },
            { id: 'notifications', label: 'Notifications', icon: Bell },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 text-[11px] font-medium transition-colors border-b-2",
                activeTab === tab.id 
                  ? "bg-white text-[hsl(142,70%,35%)] border-[hsl(142,70%,35%)]" 
                  : "text-[#666] border-transparent hover:text-[#333] hover:bg-[#f0f0f0]"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="p-4 space-y-4">
            <div className="section">
              <div className="section-header">
                <div className="flex items-center gap-2">
                  <Server className="w-3.5 h-3.5" />
                  <span>System Identity</span>
                </div>
              </div>
              <div className="section-body">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="forti-label">Hostname</label>
                    <input
                      type="text"
                      value={hostname}
                      onChange={(e) => setHostname(e.target.value)}
                      className="forti-input w-full"
                    />
                  </div>
                  <div>
                    <label className="forti-label">Domain</label>
                    <input
                      type="text"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      className="forti-input w-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="section">
              <div className="section-header">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Time Settings</span>
                </div>
              </div>
              <div className="section-body">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="forti-label">Timezone</label>
                    <select 
                      value={timezone} 
                      onChange={(e) => setTimezone(e.target.value)}
                      className="forti-select w-full"
                    >
                      <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (UTC+7)</option>
                      <option value="Asia/Bangkok">Asia/Bangkok (UTC+7)</option>
                      <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                  <div>
                    <label className="forti-label">NTP Server</label>
                    <input
                      type="text"
                      value={ntpServer}
                      onChange={(e) => setNtpServer(e.target.value)}
                      className="forti-input w-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="section">
              <div className="section-header-neutral">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Auto Update</span>
                </div>
              </div>
              <div className="section-body">
                <div className="forti-feature-item">
                  <div>
                    <div className="text-[11px] font-medium">Enable Auto Update</div>
                    <div className="text-[10px] text-[#666]">Automatically update signatures and system</div>
                  </div>
                  <FortiToggle enabled={autoUpdate} onToggle={() => setAutoUpdate(!autoUpdate)} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Network Tab */}
        {activeTab === 'network' && (
          <div className="p-4 space-y-4">
            <div className="section">
              <div className="section-header">
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5" />
                  <span>DNS Settings</span>
                </div>
              </div>
              <div className="section-body space-y-4">
                <div>
                  <label className="forti-label">DNS Servers</label>
                  <input
                    type="text"
                    value={dnsServers}
                    onChange={(e) => setDnsServers(e.target.value)}
                    placeholder="Comma separated DNS servers"
                    className="forti-input w-full"
                  />
                  <p className="text-[10px] text-[#666] mt-1">Comma separated list of DNS servers</p>
                </div>
              </div>
            </div>

            <div className="section">
              <div className="section-header">
                <div className="flex items-center gap-2">
                  <Database className="w-3.5 h-3.5" />
                  <span>Syslog</span>
                </div>
              </div>
              <div className="section-body space-y-4">
                <div className="forti-feature-item">
                  <div>
                    <div className="text-[11px] font-medium">Enable Remote Syslog</div>
                    <div className="text-[10px] text-[#666]">Send logs to remote syslog server</div>
                  </div>
                  <FortiToggle enabled={syslogEnabled} onToggle={() => setSyslogEnabled(!syslogEnabled)} />
                </div>

                {syslogEnabled && (
                  <div>
                    <label className="forti-label">Syslog Server</label>
                    <input
                      type="text"
                      value={syslogServer}
                      onChange={(e) => setSyslogServer(e.target.value)}
                      className="forti-input w-full"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Administration Tab */}
        {activeTab === 'admin' && (
          <div className="p-4 space-y-4">
            <div className="section">
              <div className="section-header">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" />
                  <span>Web Interface</span>
                </div>
              </div>
              <div className="section-body">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="forti-label">HTTPS Port</label>
                    <input
                      type="text"
                      value={webGuiPort}
                      onChange={(e) => setWebGuiPort(e.target.value)}
                      className="forti-input w-full"
                    />
                  </div>
                  <div>
                    <label className="forti-label">Session Timeout (minutes)</label>
                    <input
                      type="text"
                      value={sessionTimeout}
                      onChange={(e) => setSessionTimeout(e.target.value)}
                      className="forti-input w-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="section">
              <div className="section-header">
                <div className="flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5" />
                  <span>SSH Access</span>
                </div>
              </div>
              <div className="section-body space-y-4">
                <div className="forti-feature-item">
                  <div>
                    <div className="text-[11px] font-medium">Enable SSH</div>
                    <div className="text-[10px] text-[#666]">Allow SSH access to the firewall</div>
                  </div>
                  <FortiToggle enabled={sshEnabled} onToggle={() => setSshEnabled(!sshEnabled)} />
                </div>

                {sshEnabled && (
                  <div>
                    <label className="forti-label">SSH Port</label>
                    <input
                      type="text"
                      value={sshPort}
                      onChange={(e) => setSshPort(e.target.value)}
                      className="forti-input w-full"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="p-4">
            <div className="section">
              <div className="section-header">
                <div className="flex items-center gap-2">
                  <Bell className="w-3.5 h-3.5" />
                  <span>Alert Notifications</span>
                </div>
              </div>
              <div className="section-body space-y-2">
                {notifications.map((item, idx) => (
                  <div key={idx} className="forti-feature-item">
                    <span className="text-[11px]">{item.label}</span>
                    <FortiToggle 
                      enabled={item.enabled} 
                      onToggle={() => toggleNotification(idx)}
                      size="sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
};

export default SystemSettings;
