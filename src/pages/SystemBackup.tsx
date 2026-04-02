import { useState, useRef, useEffect } from 'react';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { 
  Download, 
  Upload, 
  FileJson, 
  Check, 
  AlertTriangle,
  Shield,
  Network,
  Clock,
  ArrowRightLeft,
  Package,
  HardDrive,
  Settings,
  Users,
  Globe,
  Database,
  Wifi,
  Lock,
  Server,
  RefreshCw,
  History,
  Calendar,
  Play,
  Pause,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useConfigBackups } from '@/hooks/useConfigBackups';
import { formatFileSize as formatSize } from '@/lib/formatters';
import { useSystemSettings } from '@/hooks/useDbData';
import { systemSettingsApi } from '@/lib/api';
import { apiRequest } from '@/lib/queryClient';
import { useQueryClient } from '@tanstack/react-query';

interface ExportConfig {
  system: boolean;
  interfaces: boolean;
  firewallRules: boolean;
  natRules: boolean;
  aliases: boolean;
  services: boolean;
  schedules: boolean;
  ipPools: boolean;
  vpn: boolean;
  dns: boolean;
  dhcp: boolean;
  users: boolean;
  certificates: boolean;
  securityProfiles: boolean;
  routing: boolean;
}

interface ImportPreview {
  sections: Record<string, number>;
  version: string;
  exportDate: string;
  hostname: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const configSections = [
  { key: 'system', apiKey: 'system', label: 'System Settings', icon: Settings, color: 'text-slate-600' },
  { key: 'interfaces', apiKey: 'network_interfaces', label: 'Network Interfaces', icon: Network, color: 'text-blue-600' },
  { key: 'firewallRules', apiKey: 'firewall_rules', label: 'Firewall Rules', icon: Shield, color: 'text-red-600' },
  { key: 'natRules', apiKey: 'nat_rules', label: 'NAT Rules', icon: ArrowRightLeft, color: 'text-green-600' },
  { key: 'aliases', apiKey: 'aliases', label: 'Aliases', icon: Database, color: 'text-amber-600' },
  { key: 'services', apiKey: 'services', label: 'Services', icon: Server, color: 'text-purple-600' },
  { key: 'schedules', apiKey: 'schedules', label: 'Schedules', icon: Clock, color: 'text-cyan-600' },
  { key: 'ipPools', apiKey: 'ip_pools', label: 'IP Pools', icon: HardDrive, color: 'text-orange-600' },
  { key: 'vpn', apiKey: 'vpn_tunnels', label: 'VPN Configuration', icon: Lock, color: 'text-green-700' },
  { key: 'dns', apiKey: 'dns_local_records', label: 'DNS Server', icon: Globe, color: 'text-indigo-600' },
  { key: 'dhcp', apiKey: 'dhcp_servers', label: 'DHCP Server', icon: Wifi, color: 'text-teal-600' },
  { key: 'users', apiKey: 'users', label: 'User Accounts', icon: Users, color: 'text-pink-600' },
  { key: 'certificates', apiKey: 'certificates', label: 'Certificates', icon: Lock, color: 'text-yellow-600' },
  { key: 'securityProfiles', apiKey: 'ssl_inspection_profiles', label: 'Security Profiles', icon: Shield, color: 'text-rose-600' },
  { key: 'routing', apiKey: 'static_routes', label: 'Routing', icon: ArrowRightLeft, color: 'text-lime-600' },
];

interface ScheduledBackup {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  day?: number;
  enabled: boolean;
  lastRun?: string;
  nextRun: string;
  retention: number;
}

const getNextRun = (frequency: string, time: string, day?: number): string => {
  const now = new Date();
  const [hours, minutes] = time.split(':').map(Number);
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);
  if (next <= now) {
    if (frequency === 'daily') next.setDate(next.getDate() + 1);
    else if (frequency === 'weekly') next.setDate(next.getDate() + 7);
    else next.setMonth(next.getMonth() + 1);
  }
  return next.toISOString().replace('T', ' ').split('.')[0];
};

const SystemBackup = () => {
  const queryClient = useQueryClient();
  const { backups: dbBackups, loading: backupsLoading, recordBackup } = useConfigBackups();
  const { data: dbSettings = [] } = useSystemSettings();

  const recentBackups = dbBackups.length > 0
    ? dbBackups.slice(0, 4).map(b => ({
        date: new Date(b.created_at).toLocaleString(),
        size: formatSize(b.size_bytes),
        type: b.type === 'manual' ? 'Manual' : b.type === 'auto' ? 'Auto' : b.type === 'scheduled' ? 'Scheduled' : 'Pre-Upgrade',
        status: b.status,
      }))
    : [];

  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    system: true, interfaces: true, firewallRules: true, natRules: true,
    aliases: true, services: true, schedules: true, ipPools: true,
    vpn: true, dns: true, dhcp: true, users: true,
    certificates: true, securityProfiles: true, routing: true,
  });
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importData, setImportData] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scheduled backups — persisted in system_settings as JSON
  const [scheduledBackups, setScheduledBackups] = useState<ScheduledBackup[]>([]);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledBackup | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    frequency: 'daily' as 'daily' | 'weekly' | 'monthly',
    time: '02:00',
    day: 0,
    retention: 7,
    enabled: true,
  });

  // Load scheduled backups from system_settings
  useEffect(() => {
    if (!dbSettings || (dbSettings as any[]).length === 0) return;
    const raw = (dbSettings as any[]).find((s: any) => s.key === 'scheduled_backups')?.value;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setScheduledBackups(parsed);
      } catch { /* ignore */ }
    }
  }, [dbSettings]);

  const persistSchedules = async (schedules: ScheduledBackup[]) => {
    await systemSettingsApi.upsert('scheduled_backups', JSON.stringify(schedules));
    queryClient.invalidateQueries({ queryKey: ['system-settings'] });
  };

  const selectedCount = Object.values(exportConfig).filter(Boolean).length;
  const allSelected = selectedCount === configSections.length;

  const toggleAll = () => {
    const newValue = !allSelected;
    const newConfig = { ...exportConfig };
    configSections.forEach(s => { newConfig[s.key as keyof ExportConfig] = newValue; });
    setExportConfig(newConfig);
  };

  const getSectionsParam = () => {
    return configSections
      .filter(s => exportConfig[s.key as keyof ExportConfig])
      .map(s => s.apiKey)
      .join(',');
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/backup/export?sections=${getSectionsParam()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      const content = JSON.stringify(data, null, 2);
      const filename = `sonaro-gate-backup-${new Date().toISOString().split('T')[0]}.json`;
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Record in history
      const sectionNames = configSections.filter(s => exportConfig[s.key as keyof ExportConfig]).map(s => s.label);
      await recordBackup({
        filename,
        size_bytes: content.length,
        type: 'manual',
        status: 'success',
        firmware_version: '2025.1',
        sections: sectionNames,
        notes: `Full system backup — ${selectedCount} sections`,
      });

      toast.success(`Full system backup exported: ${filename}`);
    } catch {
      toast.error('Export failed — check connection');
    } finally {
      setExporting(false);
    }
  };

  const handlePreview = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/backup/export?sections=${getSectionsParam()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Preview failed');
      const data = await res.json();
      setPreviewContent(JSON.stringify(data, null, 2));
      setPreviewOpen(true);
    } catch {
      toast.error('Preview failed');
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        const sections: Record<string, number> = {};
        configSections.forEach(section => {
          const key = section.apiKey;
          const val = data[key] || data[section.key];
          if (val) sections[section.key] = Array.isArray(val) ? val.length : 1;
        });
        const errors: string[] = [];
        const warnings: string[] = [];
        if (!data.version) errors.push('Missing version field');
        if (data.version && data.version !== '2.0' && data.version !== '1.0') warnings.push(`Unknown version: ${data.version}`);
        if (Object.keys(sections).length === 0) errors.push('No configuration sections found');
        if (data.hostname && data.hostname !== 'SONARO-GATE') warnings.push(`Backup from different device: ${data.hostname}`);
        setImportPreview({ sections, version: data.version || 'unknown', exportDate: data.exportDate || 'unknown', hostname: data.hostname || 'unknown', valid: errors.length === 0, errors, warnings });
        setImportData(data);
        setImporting(true);
      } catch { toast.error('Failed to parse backup file'); }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRestore = () => {
    if (!importData) return;
    setConfirmRestore(true);
  };

  const confirmRestoreAction = async () => {
    setConfirmRestore(false);
    try {
      const res = await apiRequest('POST', '/api/backup/import', importData);
      const result = await res.json();
      if (result.ok) {
        const imported = Object.entries(result.imported)
          .map(([k, v]) => `${v} ${k.replace(/_/g, ' ')}`)
          .join(', ');
        toast.success(`System restored: ${imported || 'configuration applied'}`);
      } else {
        toast.error(result.error || 'Restore failed');
      }
    } catch {
      toast.error('Restore failed — check connection');
    } finally {
      setImporting(false);
      setImportPreview(null);
      setImportData(null);
    }
  };

  const cancelImport = () => {
    setImporting(false);
    setImportPreview(null);
    setImportData(null);
  };

  // Scheduled backup handlers
  const handleCreateSchedule = () => {
    setEditingSchedule(null);
    setScheduleForm({ name: '', frequency: 'daily', time: '02:00', day: 0, retention: 7, enabled: true });
    setScheduleModalOpen(true);
  };

  const handleEditSchedule = (schedule: ScheduledBackup) => {
    setEditingSchedule(schedule);
    setScheduleForm({ name: schedule.name, frequency: schedule.frequency, time: schedule.time, day: schedule.day || 0, retention: schedule.retention, enabled: schedule.enabled });
    setScheduleModalOpen(true);
  };

  const handleSaveSchedule = async () => {
    if (!scheduleForm.name) { toast.error('Please enter a schedule name'); return; }
    let updated: ScheduledBackup[];
    if (editingSchedule) {
      updated = scheduledBackups.map(s => s.id === editingSchedule.id ? { ...s, ...scheduleForm, nextRun: getNextRun(scheduleForm.frequency, scheduleForm.time, scheduleForm.day) } : s);
      toast.success('Schedule updated');
    } else {
      const newSchedule: ScheduledBackup = { id: crypto.randomUUID(), ...scheduleForm, nextRun: getNextRun(scheduleForm.frequency, scheduleForm.time, scheduleForm.day) };
      updated = [...scheduledBackups, newSchedule];
      toast.success('Schedule created');
    }
    setScheduledBackups(updated);
    await persistSchedules(updated);
    setScheduleModalOpen(false);
  };

  const handleToggleSchedule = async (id: string) => {
    const updated = scheduledBackups.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s);
    setScheduledBackups(updated);
    const schedule = updated.find(s => s.id === id);
    toast.success(`Schedule ${schedule?.enabled ? 'enabled' : 'disabled'}`);
    await persistSchedules(updated);
  };

  const handleDeleteSchedule = async (id: string) => {
    const updated = scheduledBackups.filter(s => s.id !== id);
    setScheduledBackups(updated);
    await persistSchedules(updated);
    toast.success('Schedule deleted');
  };

  const handleRunNow = async (schedule: ScheduledBackup) => {
    toast.info(`Running backup: ${schedule.name}…`);
    try {
      const res = await fetch(`/api/backup/export?sections=firewall_rules,nat_rules,aliases,schedules`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const content = JSON.stringify(data, null, 2);
      const filename = `${schedule.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
      await recordBackup({ filename, size_bytes: content.length, type: 'scheduled', status: 'success', firmware_version: '2025.1', sections: ['Firewall Rules', 'NAT Rules', 'Aliases', 'Schedules'], notes: `Scheduled: ${schedule.name}` });
      // Update lastRun
      const updated = scheduledBackups.map(s => s.id === schedule.id ? { ...s, lastRun: new Date().toISOString().replace('T', ' ').split('.')[0], nextRun: getNextRun(s.frequency, s.time, s.day) } : s);
      setScheduledBackups(updated);
      await persistSchedules(updated);
      toast.success(`Backup completed: ${schedule.name}`);
    } catch {
      toast.error('Backup run failed');
    }
  };

  return (
    <Shell>
      <div className="space-y-4 animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[hsl(142,70%,35%)]/10 rounded-lg">
              <Package className="w-5 h-5 text-[hsl(142,70%,35%)]" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#333]">System Backup & Restore</h1>
              <p className="text-[11px] text-[#666]">Export and import complete system configuration</p>
            </div>
          </div>
          <button className="forti-toolbar-btn" onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/crud/config_backups'] })}>
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Export Section */}
          <div className="lg:col-span-2 section">
            <div className="section-header flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                <span>Export Full Backup</span>
              </div>
              <button className="text-[10px] text-blue-600 hover:underline" onClick={toggleAll}>
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="section-body">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                {configSections.map((section) => (
                  <div
                    key={section.key}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors",
                      exportConfig[section.key as keyof ExportConfig]
                        ? "border-[hsl(142,70%,35%)]/50 bg-[hsl(142,70%,35%)]/5"
                        : "border-[#ddd] bg-[#f9f9f9] hover:bg-[#f0f0f0]"
                    )}
                    onClick={() => setExportConfig(prev => ({ ...prev, [section.key]: !prev[section.key as keyof ExportConfig] }))}
                  >
                    <input type="checkbox" className="forti-checkbox" checked={exportConfig[section.key as keyof ExportConfig]} onChange={() => {}} />
                    <section.icon className={cn("w-3.5 h-3.5", section.color)} />
                    <span className="text-[10px] font-medium truncate">{section.label}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-[#ddd]">
                <Button variant="outline" size="sm" onClick={handlePreview} disabled={selectedCount === 0 || exporting}>
                  Preview
                </Button>
                <Button size="sm" onClick={handleExport} disabled={selectedCount === 0 || exporting} className="flex-1">
                  <Download className="w-3 h-3 mr-1" />
                  {exporting ? 'Exporting…' : `Export ${selectedCount} Sections`}
                </Button>
              </div>
            </div>
          </div>

          {/* Recent Backups */}
          <div className="section">
            <div className="section-header">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4" />
                <span>Recent Backups</span>
              </div>
            </div>
            <div className="section-body">
              {backupsLoading ? (
                <div className="text-center text-[11px] text-[#999] py-4">Loading…</div>
              ) : recentBackups.length === 0 ? (
                <div className="text-center text-[11px] text-[#999] py-4">No backups yet</div>
              ) : (
                <div className="space-y-2">
                  {recentBackups.map((backup, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-[#f5f5f5] border border-[#ddd] rounded text-[10px]">
                      <div>
                        <div className="font-medium">{backup.date}</div>
                        <div className="text-[#666]">{backup.type} • {backup.size}</div>
                      </div>
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 border border-green-200 rounded text-[9px]">
                        {backup.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scheduled Backups Section */}
        <div className="section">
          <div className="section-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Scheduled Backups</span>
            </div>
            <button className="text-[10px] text-[hsl(142,70%,35%)] hover:underline" onClick={handleCreateSchedule}>
              + Add Schedule
            </button>
          </div>
          <div className="section-body">
            {scheduledBackups.length === 0 ? (
              <div className="text-center py-4 text-[11px] text-[#666]">
                No scheduled backups configured
              </div>
            ) : (
              <div className="space-y-2">
                {scheduledBackups.map((schedule) => (
                  <div
                    key={schedule.id}
                    className={cn(
                      "flex items-center justify-between p-3 border rounded",
                      schedule.enabled ? "bg-[#f5f5f5] border-[#ddd]" : "bg-gray-100 border-gray-200 opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleSchedule(schedule.id)}
                        className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-colors", schedule.enabled ? "bg-[hsl(142,70%,35%)] text-white" : "bg-gray-300 text-gray-600")}
                      >
                        {schedule.enabled ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                      </button>
                      <div>
                        <div className="text-[11px] font-medium">{schedule.name}</div>
                        <div className="text-[10px] text-[#666]">
                          {schedule.frequency.charAt(0).toUpperCase() + schedule.frequency.slice(1)} at {schedule.time}
                          {schedule.frequency === 'weekly' && ` (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][schedule.day || 0]})`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-[10px] text-[#666]">Next run</div>
                        <div className="text-[10px] font-mono">{schedule.nextRun}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-[#666]">Retention</div>
                        <div className="text-[10px]">{schedule.retention} backups</div>
                      </div>
                      {schedule.lastRun && (
                        <div className="text-right">
                          <div className="text-[10px] text-[#666]">Last run</div>
                          <div className="text-[10px] font-mono">{schedule.lastRun}</div>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 text-blue-600 hover:bg-blue-100 rounded" onClick={() => handleRunNow(schedule)} title="Run Now">
                          <Play className="w-3 h-3" />
                        </button>
                        <button className="p-1.5 text-gray-600 hover:bg-gray-200 rounded" onClick={() => handleEditSchedule(schedule)} title="Edit">
                          <Settings className="w-3 h-3" />
                        </button>
                        <button className="p-1.5 text-red-600 hover:bg-red-100 rounded" onClick={() => handleDeleteSchedule(schedule.id)} title="Delete">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Import Section */}
        <div className="section">
          <div className="section-header">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              <span>Import & Restore</span>
            </div>
          </div>
          <div className="section-body">
            {!importing ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#ccc] rounded-lg p-8 text-center cursor-pointer hover:border-[hsl(142,70%,35%)] hover:bg-[hsl(142,70%,35%)]/5 transition-colors"
                >
                  <Package className="w-10 h-10 mx-auto text-[#999] mb-3" />
                  <p className="text-[11px] text-[#666] mb-1">Click to select backup file or drag & drop</p>
                  <p className="text-[10px] text-[#999]">Supports .json backup files exported from Sonaro Gate</p>
                </div>
                <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-amber-800">
                      <strong>Important:</strong>
                      <ul className="mt-1 space-y-1 list-disc list-inside">
                        <li>Restoring merges with existing configuration</li>
                        <li>Duplicate objects are skipped (no overwrite)</li>
                        <li>Create a backup before restoring</li>
                        <li>Verify backup compatibility before import</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {importPreview && (
                  <>
                    <div className={cn("flex items-center gap-2 p-3 rounded-lg", importPreview.valid ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200")}>
                      {importPreview.valid ? <Check className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
                      <span className={cn("text-[11px] font-medium", importPreview.valid ? "text-green-700" : "text-red-700")}>
                        {importPreview.valid ? 'Backup file validated successfully' : 'Validation errors found'}
                      </span>
                    </div>
                    {importPreview.errors.length > 0 && (
                      <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-[11px] text-red-700 space-y-1">
                        {importPreview.errors.map((error, idx) => <div key={idx}>• {error}</div>)}
                      </div>
                    )}
                    {importPreview.warnings.length > 0 && (
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-700 space-y-1">
                        {importPreview.warnings.map((warning, idx) => <div key={idx}>⚠ {warning}</div>)}
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div className="p-2 bg-[#f5f5f5] border border-[#ddd] rounded">
                        <div className="text-[#666]">Version</div>
                        <div className="font-mono font-medium">{importPreview.version}</div>
                      </div>
                      <div className="p-2 bg-[#f5f5f5] border border-[#ddd] rounded">
                        <div className="text-[#666]">Source Device</div>
                        <div className="font-medium">{importPreview.hostname}</div>
                      </div>
                      <div className="p-2 bg-[#f5f5f5] border border-[#ddd] rounded">
                        <div className="text-[#666]">Export Date</div>
                        <div className="font-medium">{new Date(importPreview.exportDate).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                      {configSections.filter(s => importPreview.sections[s.key]).map((section) => (
                        <div key={section.key} className="flex items-center gap-1.5 p-2 bg-[#f5f5f5] border border-[#ddd] rounded">
                          <section.icon className={cn("w-3 h-3", section.color)} />
                          <span className="text-[10px] font-medium truncate">{section.label}</span>
                          <span className="text-[9px] text-[#666] ml-auto">{importPreview.sections[section.key] || '✓'}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 pt-3 border-t border-[#ddd]">
                      <Button variant="outline" size="sm" onClick={cancelImport}>Cancel</Button>
                      <Button size="sm" onClick={handleRestore} disabled={!importPreview.valid} className="flex-1 bg-amber-600 hover:bg-amber-700">
                        <Upload className="w-3 h-3 mr-1" />
                        Restore System Configuration
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] bg-white">
          <DialogHeader>
            <DialogTitle>Backup Preview (JSON)</DialogTitle>
          </DialogHeader>
          <pre className="text-[10px] font-mono bg-[#f5f5f5] text-[#333] p-4 rounded border border-[#ddd] overflow-auto max-h-[60vh]">
            {previewContent}
          </pre>
        </DialogContent>
      </Dialog>

      {/* Schedule Modal */}
      <Dialog open={scheduleModalOpen} onOpenChange={setScheduleModalOpen}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? 'Edit Scheduled Backup' : 'Create Scheduled Backup'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="forti-label">Schedule Name *</label>
              <input type="text" className="forti-input w-full" value={scheduleForm.name} onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })} placeholder="e.g., Daily Backup" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="forti-label">Frequency</label>
                <select className="forti-select w-full" value={scheduleForm.frequency} onChange={(e) => setScheduleForm({ ...scheduleForm, frequency: e.target.value as any })}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="forti-label">Time</label>
                <input type="time" className="forti-input w-full" value={scheduleForm.time} onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })} />
              </div>
            </div>
            {scheduleForm.frequency === 'weekly' && (
              <div>
                <label className="forti-label">Day of Week</label>
                <select className="forti-select w-full" value={scheduleForm.day} onChange={(e) => setScheduleForm({ ...scheduleForm, day: parseInt(e.target.value) })}>
                  <option value={0}>Sunday</option><option value={1}>Monday</option><option value={2}>Tuesday</option>
                  <option value={3}>Wednesday</option><option value={4}>Thursday</option><option value={5}>Friday</option><option value={6}>Saturday</option>
                </select>
              </div>
            )}
            {scheduleForm.frequency === 'monthly' && (
              <div>
                <label className="forti-label">Day of Month</label>
                <input type="number" className="forti-input w-full" min={1} max={28} value={scheduleForm.day} onChange={(e) => setScheduleForm({ ...scheduleForm, day: parseInt(e.target.value) })} />
              </div>
            )}
            <div>
              <label className="forti-label">Retention (number of backups to keep)</label>
              <input type="number" className="forti-input w-full" min={1} max={100} value={scheduleForm.retention} onChange={(e) => setScheduleForm({ ...scheduleForm, retention: parseInt(e.target.value) })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={scheduleForm.enabled} onCheckedChange={(checked) => setScheduleForm({ ...scheduleForm, enabled: checked })} />
              <span className="text-[11px]">Enable schedule</span>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" size="sm" onClick={() => setScheduleModalOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveSchedule}>Save Schedule</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation */}
      <AlertDialog open={confirmRestore} onOpenChange={setConfirmRestore}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Confirm System Restore
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>You are about to restore the system configuration from backup.</p>
              <ul className="text-[11px] space-y-1 list-disc list-inside mt-2">
                <li>Configuration will be merged with existing data</li>
                <li>Duplicate objects will be skipped</li>
                <li>Active sessions may be interrupted</li>
              </ul>
              <p className="font-medium mt-3">Are you sure you want to continue?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestoreAction} className="bg-amber-600 hover:bg-amber-700">
              Restore Configuration
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
};

export default SystemBackup;
