import { useState, useEffect } from 'react';
import { useInterfaces } from '@/hooks/useDashboardData';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { formatUptimeShort as formatUptime } from '@/lib/formatters';
import { FortiToggle } from '@/components/ui/forti-toggle';
import { 
  Server, 
  RefreshCw, 
  Settings, 
  Activity,
  CheckCircle2,
  XCircle,
  ArrowLeftRight,
  Clock,
  Plus,
  Edit2,
  Trash2,
  X,
  Download,
  Upload
} from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSystemSettings } from '@/hooks/useDbData';
import { systemSettingsApi } from '@/lib/api';
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

interface ClusterMember {
  id: string;
  hostname: string;
  role: 'primary' | 'secondary' | 'standby';
  status: 'active' | 'passive' | 'offline' | 'syncing';
  priority: number;
  serialNumber: string;
  uptime: number;
  cpu: number;
  memory: number;
  sessions: number;
  lastSync: Date;
}

const HighAvailability = () => {
  const queryClient = useQueryClient();
  const { data: dbSettings = [] } = useSystemSettings();

  const [haEnabled, setHaEnabled] = useState(false);
  const [haMode, setHaMode] = useState<'active-passive' | 'active-active'>('active-passive');
  const [members, setMembers] = useState<ClusterMember[]>([]);
  const [activeTab, setActiveTab] = useState<'status' | 'settings' | 'history'>('status');
  
  // Modal states
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<ClusterMember | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  
  // Form state
  const [memberForm, setMemberForm] = useState<Partial<ClusterMember>>({});
  
  // HA Settings
  const [groupName, setGroupName] = useState('SONARO-HA-CLUSTER');
  const [groupId, setGroupId] = useState('1');
  const [password, setPassword] = useState('');
  const [heartbeatInterface, setHeartbeatInterface] = useState('');
  const [monitorInterfaces, setMonitorInterfaces] = useState<string[]>([]);
  const ifacesQuery = useInterfaces();
  const [sessionPickup, setSessionPickup] = useState(true);
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [pingServer, setPingServer] = useState('8.8.8.8');

  // Load HA settings from DB
  useEffect(() => {
    if (!dbSettings || (dbSettings as any[]).length === 0) return;
    const get = (key: string) => (dbSettings as any[]).find((s: any) => s.key === key)?.value;
    const haEnabledVal = get('ha_enabled');
    if (haEnabledVal !== undefined) setHaEnabled(haEnabledVal === 'true');
    const haModeVal = get('ha_mode');
    if (haModeVal) setHaMode(haModeVal as any);
    const grpName = get('ha_group_name');
    if (grpName) setGroupName(grpName);
    const grpId = get('ha_group_id');
    if (grpId) setGroupId(grpId);
    const hbIface = get('ha_heartbeat_interface');
    if (hbIface) setHeartbeatInterface(hbIface);
    const sessPickup = get('ha_session_pickup');
    if (sessPickup !== undefined) setSessionPickup(sessPickup === 'true');
    const override = get('ha_override');
    if (override !== undefined) setOverrideEnabled(override === 'true');
    const ping = get('ha_ping_server');
    if (ping) setPingServer(ping);
    const membersRaw = get('ha_members');
    if (membersRaw) {
      try {
        const parsed = JSON.parse(membersRaw);
        if (Array.isArray(parsed)) setMembers(parsed.map((m: any) => ({ ...m, lastSync: new Date(m.lastSync || Date.now()) })));
      } catch { /* ignore */ }
    }
  }, [dbSettings]);

  const persistMembers = async (membersList: ClusterMember[]) => {
    await systemSettingsApi.upsert('ha_members', JSON.stringify(membersList.map(m => ({ ...m, lastSync: m.lastSync instanceof Date ? m.lastSync.toISOString() : m.lastSync }))));
    queryClient.invalidateQueries({ queryKey: ['system-settings'] });
  };

  const saveSettingsMut = useMutation({
    mutationFn: async () => {
      const settings: [string, string][] = [
        ['ha_enabled', String(haEnabled)],
        ['ha_mode', haMode],
        ['ha_group_name', groupName],
        ['ha_group_id', groupId],
        ['ha_heartbeat_interface', heartbeatInterface],
        ['ha_session_pickup', String(sessionPickup)],
        ['ha_override', String(overrideEnabled)],
        ['ha_ping_server', pingServer],
      ];
      for (const [key, value] of settings) {
        await systemSettingsApi.upsert(key, value);
      }
      await persistMembers(members);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['system-settings'] }); toast.success('HA settings saved'); },
    onError: () => toast.error('Failed to save HA settings'),
  });

  

  const formatSyncTime = (date: Date): string => {
    const diff = Date.now() - date.getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs}s ago`;
    return `${Math.floor(secs / 60)}m ago`;
  };

  const handleFailover = () => {
    toast.success('Manual failover initiated');
    setMembers(prev => prev.map(m => ({
      ...m,
      role: m.role === 'primary' ? 'secondary' : 'primary',
      status: m.status === 'active' ? 'passive' : 'active',
    })));
  };

  const handleSync = () => {
    toast.success('Configuration sync initiated');
    setMembers(prev => prev.map(m => ({
      ...m,
      lastSync: new Date(),
    })));
  };

  const handleCreateMember = () => {
    setEditingMember(null);
    setMemberForm({
      hostname: '',
      role: 'secondary',
      status: 'passive',
      priority: 100,
      serialNumber: '',
    });
    setShowMemberModal(true);
  };

  const handleEditMember = (member: ClusterMember) => {
    setEditingMember(member);
    setMemberForm(member);
    setShowMemberModal(true);
  };

  const handleSaveMember = async () => {
    if (!memberForm.hostname || !memberForm.serialNumber) {
      toast.error('Hostname and Serial Number are required');
      return;
    }
    let updated: ClusterMember[];
    if (editingMember) {
      updated = members.map(m => m.id === editingMember.id ? { ...m, ...memberForm } as ClusterMember : m);
      toast.success('Cluster member updated');
    } else {
      const newMember: ClusterMember = {
        id: crypto.randomUUID(),
        hostname: memberForm.hostname!,
        role: memberForm.role || 'secondary',
        status: 'passive',
        priority: memberForm.priority || 100,
        serialNumber: memberForm.serialNumber!,
        uptime: 0, cpu: 0, memory: 0, sessions: 0,
        lastSync: new Date(),
      };
      updated = [...members, newMember];
      toast.success('Cluster member added');
    }
    setMembers(updated);
    await persistMembers(updated);
    setShowMemberModal(false);
  };

  const handleDeleteConfirm = (id: string) => {
    setMemberToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (memberToDelete) {
      const updated = members.filter(m => m.id !== memberToDelete);
      setMembers(updated);
      await persistMembers(updated);
      toast.success('Cluster member removed');
    }
    setDeleteConfirmOpen(false);
    setMemberToDelete(null);
  };

  const handleExport = () => {
    const data = {
      haEnabled,
      haMode,
      groupName,
      groupId,
      heartbeatInterface,
      monitorInterfaces,
      sessionPickup,
      overrideEnabled,
      pingServer,
      members,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ha_config.json';
    a.click();
    toast.success('HA configuration exported');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target?.result as string);
            if (data.haEnabled !== undefined) setHaEnabled(data.haEnabled);
            if (data.haMode) setHaMode(data.haMode);
            if (data.groupName) setGroupName(data.groupName);
            if (data.members) setMembers(data.members);
            toast.success('HA configuration imported');
          } catch {
            toast.error('Invalid file format');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <Shell>
      <div className="space-y-0 animate-slide-in">
        {/* FortiGate Toolbar */}
        <div className="forti-toolbar">
          <button onClick={handleSync} className="forti-toolbar-btn primary">
            <RefreshCw className="w-3 h-3" />
            Synchronize
          </button>
          <button onClick={handleFailover} className="forti-toolbar-btn">
            <ArrowLeftRight className="w-3 h-3" />
            Manual Failover
          </button>
          <button onClick={handleCreateMember} className="forti-toolbar-btn">
            <Plus className="w-3 h-3" />
            Add Member
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={handleExport}>
            <Download className="w-3 h-3" />
            Export
          </button>
          <button className="forti-toolbar-btn" onClick={handleImport}>
            <Upload className="w-3 h-3" />
            Import
          </button>
          <div className="forti-toolbar-separator" />
          <div className="flex items-center gap-2 px-2">
            <span className="text-[11px] text-[#333]">HA Mode:</span>
            <FortiToggle enabled={haEnabled} onToggle={() => setHaEnabled(!haEnabled)} size="sm" />
            <span className={cn("text-[11px] font-medium", haEnabled ? "text-green-600" : "text-[#666]")}>
              {haEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="flex-1" />
        </div>

        {/* HA Status Banner */}
        <div className={cn(
          "flex items-center gap-3 px-4 py-3 border-b",
          haEnabled ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
        )}>
          {haEnabled ? (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          ) : (
            <XCircle className="w-5 h-5 text-gray-400" />
          )}
          <div>
            <div className={cn("text-[12px] font-semibold", haEnabled ? "text-green-700" : "text-[#333]")}>
              {haEnabled ? 'High Availability Active' : 'High Availability Disabled'}
            </div>
            <div className="text-[10px] text-[#333]">
              {haEnabled 
                ? `Cluster: ${groupName} | Mode: ${haMode === 'active-passive' ? 'Active-Passive' : 'Active-Active'} | Members: ${members.length}`
                : 'Enable HA to configure cluster settings'
              }
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center bg-[#e8e8e8] border-b border-[#ccc]">
          {[
            { id: 'status', label: 'Cluster Status', icon: Activity },
            { id: 'settings', label: 'HA Settings', icon: Settings },
            { id: 'history', label: 'Failover History', icon: Clock },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 text-[11px] font-medium transition-colors border-b-2",
                activeTab === tab.id 
                  ? "bg-white text-[hsl(142,70%,35%)] border-[hsl(142,70%,35%)]" 
                  : "text-[#333] border-transparent hover:text-[#111] hover:bg-[#f0f0f0]"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Cluster Status Tab */}
        {activeTab === 'status' && haEnabled && (
          <div className="p-4 space-y-4">
            {/* Cluster Visualization */}
            <div className="grid grid-cols-2 gap-4">
              {members.map((member) => (
                <div key={member.id} className={cn(
                  "section",
                  member.status === 'active' && "ring-2 ring-green-500"
                )}>
                  <div className={cn(
                    "section-header flex items-center justify-between",
                    member.status === 'active' ? "" : "!bg-gradient-to-b !from-gray-500 !to-gray-600"
                  )}>
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4" />
                      <span>{member.hostname}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-2 py-0.5 text-[9px] font-bold rounded",
                        member.status === 'active' ? "bg-white/20" : "bg-white/10"
                      )}>
                        {member.role.toUpperCase()}
                      </span>
                      <button 
                        className="p-1 hover:bg-white/20 rounded"
                        onClick={() => handleEditMember(member)}
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button 
                        className="p-1 hover:bg-white/20 rounded"
                        onClick={() => handleDeleteConfirm(member.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="section-body">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center p-3 bg-[#f5f5f5] border border-[#ddd]">
                        <div className={cn(
                          "text-lg font-bold",
                          member.status === 'active' ? "text-green-600" : "text-[#333]"
                        )}>
                          {member.status === 'active' ? 'ACTIVE' : 'STANDBY'}
                        </div>
                        <div className="text-[10px] text-[#333]">Status</div>
                      </div>
                      <div className="text-center p-3 bg-[#f5f5f5] border border-[#ddd]">
                        <div className="text-lg font-bold text-[#111]">{member.priority}</div>
                        <div className="text-[10px] text-[#333]">Priority</div>
                      </div>
                    </div>

                    <table className="widget-table">
                      <tbody>
                        <tr>
                          <td className="widget-label">Serial Number</td>
                          <td className="widget-value mono text-[10px] text-[#111]">{member.serialNumber}</td>
                        </tr>
                        <tr>
                          <td className="widget-label">Uptime</td>
                          <td className="widget-value text-[#111]">{formatUptime(member.uptime)}</td>
                        </tr>
                        <tr>
                          <td className="widget-label">Last Sync</td>
                          <td className="widget-value text-[#111]">{formatSyncTime(member.lastSync)}</td>
                        </tr>
                        <tr>
                          <td className="widget-label">Sessions</td>
                          <td className="widget-value text-[#111]">{member.sessions.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="mt-4 space-y-2">
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-[#333]">CPU</span>
                          <span className="text-[#111]">{member.cpu}%</span>
                        </div>
                        <div className="forti-progress">
                          <div 
                            className={cn(
                              "forti-progress-bar",
                              member.cpu > 80 ? "red" : member.cpu > 50 ? "orange" : "green"
                            )}
                            style={{ width: `${member.cpu}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-[#333]">Memory</span>
                          <span className="text-[#111]">{member.memory}%</span>
                        </div>
                        <div className="forti-progress">
                          <div 
                            className={cn(
                              "forti-progress-bar",
                              member.memory > 80 ? "red" : member.memory > 50 ? "orange" : "blue"
                            )}
                            style={{ width: `${member.memory}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Sync Status */}
            <div className="section">
              <div className="section-header-neutral">
                <span>Synchronization Status</span>
              </div>
              <div className="section-body">
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: 'Configuration', status: 'synced' },
                    { label: 'Sessions', status: 'synced' },
                    { label: 'Certificates', status: 'synced' },
                    { label: 'Signatures', status: 'synced' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2 p-2 bg-[#f8f8f8] border border-[#ddd]">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <div>
                        <div className="text-[11px] font-medium text-[#111]">{item.label}</div>
                        <div className="text-[10px] text-green-600">Synchronized</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* HA Settings Tab */}
        {activeTab === 'settings' && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="section">
                <div className="section-header">
                  <span>Cluster Configuration</span>
                </div>
                <div className="section-body space-y-4">
                  <div>
                    <label className="forti-label">HA Mode</label>
                    <select 
                      value={haMode} 
                      onChange={(e) => setHaMode(e.target.value as any)}
                      className="forti-select w-full"
                    >
                      <option value="active-passive">Active-Passive</option>
                      <option value="active-active">Active-Active</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="forti-label">Group Name</label>
                      <input
                        type="text"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        className="forti-input w-full"
                      />
                    </div>
                    <div>
                      <label className="forti-label">Group ID</label>
                      <input
                        type="number"
                        value={groupId}
                        onChange={(e) => setGroupId(e.target.value)}
                        className="forti-input w-full"
                        min="0"
                        max="255"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="forti-label">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="forti-input w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="section">
                <div className="section-header">
                  <span>Heartbeat & Monitoring</span>
                </div>
                <div className="section-body space-y-4">
                  <div>
                    <label className="forti-label">Heartbeat Interface</label>
                    <select 
                      value={heartbeatInterface} 
                      onChange={(e) => setHeartbeatInterface(e.target.value)}
                      className="forti-select w-full"
                    >
                      <option value="port5">port5 (Dedicated HA)</option>
                      <option value="port6">port6</option>
                      <option value="port7">port7</option>
                    </select>
                  </div>
                  <div>
                    <label className="forti-label">Monitor Interfaces</label>
                    <div className="space-y-2 mt-2">
                      {(ifacesQuery.data?.length ?? 0) === 0 ? (
                        <span className="text-[11px] text-[#999]">No interfaces detected by agent</span>
                      ) : null}
                      {(ifacesQuery.data ?? []).map((iface: any) => (
                        <label key={iface.name} className="flex items-center gap-2 text-[11px] text-[#333]">
                          <input
                            type="checkbox"
                            checked={monitorInterfaces.includes(iface.name)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setMonitorInterfaces([...monitorInterfaces, iface.name]);
                              } else {
                                setMonitorInterfaces(monitorInterfaces.filter(p => p !== iface.name));
                              }
                            }}
                            className="forti-checkbox"
                          />
                          {iface.name} ({iface.type})
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="forti-label">Ping Server (Health Check)</label>
                    <input
                      type="text"
                      value={pingServer}
                      onChange={(e) => setPingServer(e.target.value)}
                      className="forti-input w-full"
                      placeholder="8.8.8.8"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="section">
              <div className="section-header-neutral">
                <span>Failover Settings</span>
              </div>
              <div className="section-body space-y-2">
                <div className="forti-feature-item">
                  <div>
                    <div className="text-[11px] font-medium text-[#111]">Session Pickup</div>
                    <div className="text-[10px] text-[#333]">Maintain sessions during failover</div>
                  </div>
                  <FortiToggle enabled={sessionPickup} onToggle={() => setSessionPickup(!sessionPickup)} size="sm" />
                </div>
                <div className="forti-feature-item">
                  <div>
                    <div className="text-[11px] font-medium text-[#111]">Override</div>
                    <div className="text-[10px] text-[#333]">Primary unit resumes control after recovery</div>
                  </div>
                  <FortiToggle enabled={overrideEnabled} onToggle={() => setOverrideEnabled(!overrideEnabled)} size="sm" />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end gap-2">
              <button className="forti-btn forti-btn-secondary" onClick={() => queryClient.invalidateQueries({ queryKey: ['system-settings'] })}>Cancel</button>
              <button className="forti-btn forti-btn-primary" onClick={() => saveSettingsMut.mutate()} disabled={saveSettingsMut.isPending}>
                {saveSettingsMut.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* Failover History Tab */}
        {activeTab === 'history' && (
          <div className="p-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Event</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Reason</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={6} className="text-center text-[#999] py-6">
                    No failover events recorded — events will appear here when HA is active and a failover occurs
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Disabled State */}
        {activeTab === 'status' && !haEnabled && (
          <div className="p-8 text-center">
            <Server className="w-16 h-16 mx-auto text-[#ccc] mb-4" />
            <div className="text-[14px] font-medium text-[#333] mb-2">High Availability is Disabled</div>
            <div className="text-[11px] text-[#555] mb-4">Enable HA to configure cluster settings and view status</div>
            <button onClick={() => setHaEnabled(true)} className="forti-btn forti-btn-primary">
              Enable High Availability
            </button>
          </div>
        )}
      </div>

      {/* Member Modal */}
      {showMemberModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white border border-[#ccc] shadow-xl w-[500px]">
            <div className="forti-modal-header flex items-center justify-between">
              <span>{editingMember ? 'Edit Cluster Member' : 'Add Cluster Member'}</span>
              <button onClick={() => setShowMemberModal(false)} className="text-white/80 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="forti-modal-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="forti-label">Hostname *</label>
                  <input
                    type="text"
                    className="forti-input w-full"
                    placeholder="SONARO-GW-03"
                    value={memberForm.hostname || ''}
                    onChange={(e) => setMemberForm({ ...memberForm, hostname: e.target.value })}
                  />
                </div>
                <div>
                  <label className="forti-label">Serial Number *</label>
                  <input
                    type="text"
                    className="forti-input w-full"
                    placeholder="FGT60F0000000003"
                    value={memberForm.serialNumber || ''}
                    onChange={(e) => setMemberForm({ ...memberForm, serialNumber: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="forti-label">Role</label>
                  <select
                    className="forti-select w-full"
                    value={memberForm.role || 'secondary'}
                    onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value as any })}
                  >
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                    <option value="standby">Standby</option>
                  </select>
                </div>
                <div>
                  <label className="forti-label">Priority</label>
                  <input
                    type="number"
                    className="forti-input w-full"
                    value={memberForm.priority || 100}
                    onChange={(e) => setMemberForm({ ...memberForm, priority: parseInt(e.target.value) })}
                    min="0"
                    max="255"
                  />
                </div>
              </div>
            </div>
            <div className="forti-modal-footer">
              <button className="forti-btn forti-btn-secondary" onClick={() => setShowMemberModal(false)}>
                Cancel
              </button>
              <button className="forti-btn forti-btn-primary" onClick={handleSaveMember}>
                {editingMember ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Cluster Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this cluster member? This may affect HA functionality.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
};

export default HighAvailability;