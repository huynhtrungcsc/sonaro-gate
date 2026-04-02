import { useState } from 'react';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { FortiToggle } from '@/components/ui/forti-toggle';
import {
  ChevronDown, Plus, RefreshCw, Search, Edit2, Trash2,
  Globe, Server, Shield, Database, Settings, Download, Upload, Loader2
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { exportToJSON, exportToCSV, importFromJSON, createFileInput } from '@/lib/exportImport';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { dnsForwardZonesApi, dnsLocalRecordsApi, dnsFilterProfilesApi } from '@/lib/api';

interface ForwardZone {
  id: string; name: string; type: string; servers: string[]; enabled: boolean;
  created_at?: string; updated_at?: string;
}
interface LocalRecord {
  id: string; hostname: string; domain: string; type: string;
  address: string; ttl: number; enabled: boolean;
  created_at?: string; updated_at?: string;
}
interface DnsFilterProfile {
  id: string; name: string; comment: string;
  domain_filter: boolean; fortiguard_category: boolean;
  safe_search: boolean; youtube_restrict: boolean;
  log_all_domains: boolean; enabled: boolean;
  blocked_categories: number; references_count: number;
  created_at?: string; updated_at?: string;
}

const DNSServer = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'general' | 'forward' | 'local' | 'filter'>('general');
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [dnsEnabled, setDnsEnabled] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal / edit state
  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<ForwardZone | null>(null);
  const [editingRecord, setEditingRecord] = useState<LocalRecord | null>(null);
  const [editingFilter, setEditingFilter] = useState<DnsFilterProfile | null>(null);

  const [deleteZoneId, setDeleteZoneId] = useState<string | null>(null);
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);
  const [deleteFilterId, setDeleteFilterId] = useState<string | null>(null);

  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

  const [zoneForm, setZoneForm] = useState({ name: '', servers: '', enabled: true });
  const [recordForm, setRecordForm] = useState({ hostname: '', domain: 'local.lan', type: 'A', address: '', ttl: 3600, enabled: true });
  const [filterForm, setFilterForm] = useState({ name: '', comment: '', domain_filter: true, safe_search: true, fortiguard_category: true, youtube_restrict: false, log_all_domains: true, enabled: true });

  // ── Queries ──────────────────────────────────────
  const zonesQ = useQuery<ForwardZone[]>({
    queryKey: ['dns-zones', !!user],
    queryFn: () => dnsForwardZonesApi.getAll() as Promise<ForwardZone[]>,
    enabled: !!user,
    refetchInterval: 30000,
  });
  const recordsQ = useQuery<LocalRecord[]>({
    queryKey: ['dns-records', !!user],
    queryFn: () => dnsLocalRecordsApi.getAll() as Promise<LocalRecord[]>,
    enabled: !!user,
    refetchInterval: 30000,
  });
  const filtersQ = useQuery<DnsFilterProfile[]>({
    queryKey: ['dns-filter-profiles', !!user],
    queryFn: () => dnsFilterProfilesApi.getAll() as Promise<DnsFilterProfile[]>,
    enabled: !!user,
    refetchInterval: 30000,
  });

  const zones: ForwardZone[] = zonesQ.data ?? [];
  const records: LocalRecord[] = recordsQ.data ?? [];
  const filterProfiles: DnsFilterProfile[] = filtersQ.data ?? [];
  const isLoading = zonesQ.isLoading || recordsQ.isLoading || filtersQ.isLoading;

  // ── Mutations ────────────────────────────────────
  const zoneMut = useMutation({
    mutationFn: (args: { id?: string; data: Partial<ForwardZone> }) =>
      args.id ? dnsForwardZonesApi.update(args.id, args.data) : dnsForwardZonesApi.create(args.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dns-zones'] }),
  });
  const zoneDelMut = useMutation({
    mutationFn: (id: string) => dnsForwardZonesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dns-zones'] }),
  });
  const recordMut = useMutation({
    mutationFn: (args: { id?: string; data: Partial<LocalRecord> }) =>
      args.id ? dnsLocalRecordsApi.update(args.id, args.data) : dnsLocalRecordsApi.create(args.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dns-records'] }),
  });
  const recordDelMut = useMutation({
    mutationFn: (id: string) => dnsLocalRecordsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dns-records'] }),
  });
  const filterMut = useMutation({
    mutationFn: (args: { id?: string; data: Partial<DnsFilterProfile> }) =>
      args.id ? dnsFilterProfilesApi.update(args.id, args.data) : dnsFilterProfilesApi.create(args.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dns-filter-profiles'] }),
  });
  const filterDelMut = useMutation({
    mutationFn: (id: string) => dnsFilterProfilesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dns-filter-profiles'] }),
  });

  // ── Toggle helpers ──────────────────────────────
  const toggleZone = (zone: ForwardZone) => {
    zoneMut.mutate({ id: zone.id, data: { enabled: !zone.enabled } });
  };
  const toggleRecord = (record: LocalRecord) => {
    recordMut.mutate({ id: record.id, data: { enabled: !record.enabled } });
  };
  const toggleFilter = (fp: DnsFilterProfile) => {
    filterMut.mutate({ id: fp.id, data: { enabled: !fp.enabled } });
  };

  // ── Zone CRUD ────────────────────────────────────
  const handleCreateZone = () => { setEditingZone(null); setZoneForm({ name: '', servers: '', enabled: true }); setZoneModalOpen(true); };
  const handleEditZone = (z: ForwardZone) => { setEditingZone(z); setZoneForm({ name: z.name, servers: z.servers.join(', '), enabled: z.enabled }); setZoneModalOpen(true); };
  const handleSaveZone = async () => {
    if (!zoneForm.name || !zoneForm.servers) { toast.error('Please fill all required fields'); return; }
    try {
      await zoneMut.mutateAsync({
        id: editingZone?.id,
        data: { name: zoneForm.name, servers: zoneForm.servers.split(',').map(s => s.trim()), enabled: zoneForm.enabled, type: 'forward' },
      });
      toast.success(editingZone ? 'Forward zone updated' : 'Forward zone created');
      setZoneModalOpen(false);
    } catch { toast.error('Save failed'); }
  };
  const handleDeleteZone = async () => {
    if (!deleteZoneId) return;
    try { await zoneDelMut.mutateAsync(deleteZoneId); toast.success('Forward zone deleted'); } catch { toast.error('Delete failed'); }
    setDeleteZoneId(null);
  };

  // ── Record CRUD ──────────────────────────────────
  const handleCreateRecord = () => { setEditingRecord(null); setRecordForm({ hostname: '', domain: 'local.lan', type: 'A', address: '', ttl: 3600, enabled: true }); setRecordModalOpen(true); };
  const handleEditRecord = (r: LocalRecord) => { setEditingRecord(r); setRecordForm({ hostname: r.hostname, domain: r.domain, type: r.type, address: r.address, ttl: r.ttl, enabled: r.enabled }); setRecordModalOpen(true); };
  const handleSaveRecord = async () => {
    if (!recordForm.hostname || !recordForm.address) { toast.error('Please fill all required fields'); return; }
    try {
      await recordMut.mutateAsync({ id: editingRecord?.id, data: recordForm });
      toast.success(editingRecord ? 'Local record updated' : 'Local record created');
      setRecordModalOpen(false);
    } catch { toast.error('Save failed'); }
  };
  const handleDeleteRecord = async () => {
    if (!deleteRecordId) return;
    try { await recordDelMut.mutateAsync(deleteRecordId); toast.success('Local record deleted'); } catch { toast.error('Delete failed'); }
    setDeleteRecordId(null);
  };

  // ── Filter Profile CRUD ──────────────────────────
  const handleCreateFilter = () => { setEditingFilter(null); setFilterForm({ name: '', comment: '', domain_filter: true, safe_search: true, fortiguard_category: true, youtube_restrict: false, log_all_domains: true, enabled: true }); setFilterModalOpen(true); };
  const handleEditFilter = (f: DnsFilterProfile) => { setEditingFilter(f); setFilterForm({ name: f.name, comment: f.comment, domain_filter: f.domain_filter, safe_search: f.safe_search, fortiguard_category: f.fortiguard_category, youtube_restrict: f.youtube_restrict, log_all_domains: f.log_all_domains, enabled: f.enabled }); setFilterModalOpen(true); };
  const handleSaveFilter = async () => {
    if (!filterForm.name) { toast.error('Filter name is required'); return; }
    try {
      await filterMut.mutateAsync({ id: editingFilter?.id, data: filterForm });
      toast.success(editingFilter ? 'Filter profile updated' : 'Filter profile created');
      setFilterModalOpen(false);
    } catch { toast.error('Save failed'); }
  };
  const handleDeleteFilter = async () => {
    if (!deleteFilterId) return;
    try { await filterDelMut.mutateAsync(deleteFilterId); toast.success('Filter profile deleted'); } catch { toast.error('Delete failed'); }
    setDeleteFilterId(null);
  };

  // ── Export/Import ────────────────────────────────
  const handleExport = (type: 'zones' | 'records' | 'filters', format: 'json' | 'csv') => {
    const data = type === 'zones' ? zones : type === 'records' ? records : filterProfiles;
    const filename = `dns-${type}-${new Date().toISOString().split('T')[0]}`;
    if (format === 'json') exportToJSON(data as any, `${filename}.json`);
    else exportToCSV(data as any, `${filename}.csv`);
    toast.success(`Exported ${data.length} ${type}`);
  };
  const handleImport = (type: 'zones' | 'records' | 'filters') => {
    createFileInput('.json', (file) => {
      if (type === 'zones') {
        importFromJSON<ForwardZone>(file, async (data) => {
          for (const z of data) await dnsForwardZonesApi.create({ ...z, id: undefined } as any);
          queryClient.invalidateQueries({ queryKey: ['dns-zones'] });
          toast.success(`Imported ${data.length} zones`);
        }, (e) => toast.error(e));
      } else if (type === 'records') {
        importFromJSON<LocalRecord>(file, async (data) => {
          for (const r of data) await dnsLocalRecordsApi.create({ ...r, id: undefined } as any);
          queryClient.invalidateQueries({ queryKey: ['dns-records'] });
          toast.success(`Imported ${data.length} records`);
        }, (e) => toast.error(e));
      } else {
        importFromJSON<DnsFilterProfile>(file, async (data) => {
          for (const f of data) await dnsFilterProfilesApi.create({ ...f, id: undefined } as any);
          queryClient.invalidateQueries({ queryKey: ['dns-filter-profiles'] });
          toast.success(`Imported ${data.length} profiles`);
        }, (e) => toast.error(e));
      }
    });
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dns-zones'] });
    queryClient.invalidateQueries({ queryKey: ['dns-records'] });
    queryClient.invalidateQueries({ queryKey: ['dns-filter-profiles'] });
    toast.success('Data refreshed from database');
  };

  // ── Filtered views ───────────────────────────────
  const filteredZones = zones.filter(z => z.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredRecords = records.filter(r => r.hostname.toLowerCase().includes(searchTerm.toLowerCase()) || r.address.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredFilters = filterProfiles.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <Shell>
      <div className="space-y-0 animate-slide-in">
        {/* Toolbar */}
        <div className="forti-toolbar">
          <div className="relative">
            <button className="forti-toolbar-btn primary" onClick={() => setShowCreateMenu(!showCreateMenu)}>
              <Plus className="w-3 h-3" /> Create New <ChevronDown className="w-3 h-3" />
            </button>
            {showCreateMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#ccc] shadow-lg z-50 min-w-[180px]">
                <button className="w-full px-3 py-2 text-left text-[11px] hover:bg-[#f0f0f0] flex items-center gap-2" onClick={() => { handleCreateZone(); setShowCreateMenu(false); }}>
                  <Globe className="w-3 h-3" /> Forward Zone
                </button>
                <button className="w-full px-3 py-2 text-left text-[11px] hover:bg-[#f0f0f0] flex items-center gap-2" onClick={() => { handleCreateRecord(); setShowCreateMenu(false); }}>
                  <Database className="w-3 h-3" /> Local Record
                </button>
                <button className="w-full px-3 py-2 text-left text-[11px] hover:bg-[#f0f0f0] flex items-center gap-2" onClick={() => { handleCreateFilter(); setShowCreateMenu(false); }}>
                  <Shield className="w-3 h-3" /> Filter Profile
                </button>
              </div>
            )}
          </div>
          <button className="forti-toolbar-btn" onClick={() => {
            if (activeTab === 'forward' && selectedZones.length === 1) handleEditZone(zones.find(z => z.id === selectedZones[0])!);
            else if (activeTab === 'local' && selectedRecords.length === 1) handleEditRecord(records.find(r => r.id === selectedRecords[0])!);
            else if (activeTab === 'filter' && selectedFilters.length === 1) handleEditFilter(filterProfiles.find(f => f.id === selectedFilters[0])!);
          }}>
            <Edit2 className="w-3 h-3" /> Edit
          </button>
          <button className="forti-toolbar-btn" onClick={() => {
            if (activeTab === 'forward' && selectedZones.length === 1) setDeleteZoneId(selectedZones[0]);
            else if (activeTab === 'local' && selectedRecords.length === 1) setDeleteRecordId(selectedRecords[0]);
            else if (activeTab === 'filter' && selectedFilters.length === 1) setDeleteFilterId(selectedFilters[0]);
          }}>
            <Trash2 className="w-3 h-3" /> Delete
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} /> Refresh
          </button>
          <button className="forti-toolbar-btn" onClick={() => {
            if (activeTab === 'forward') handleExport('zones', 'json');
            else if (activeTab === 'local') handleExport('records', 'json');
            else handleExport('filters', 'json');
          }}>
            <Download className="w-3 h-3" /> Export
          </button>
          <button className="forti-toolbar-btn" onClick={() => {
            if (activeTab === 'forward') handleImport('zones');
            else if (activeTab === 'local') handleImport('records');
            else handleImport('filters');
          }}>
            <Upload className="w-3 h-3" /> Import
          </button>
          <div className="flex-1" />
          {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          <div className="forti-search">
            <Search className="w-3 h-3 text-[#999]" />
            <input type="text" placeholder="Search..." className="w-40" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center bg-[#e8e8e8] border-b border-[#ccc]">
          {[
            { id: 'general', label: 'General Settings', icon: Settings },
            { id: 'forward', label: `Forward Zones (${zones.length})`, icon: Globe },
            { id: 'local', label: `Local Records (${records.length})`, icon: Database },
            { id: 'filter', label: `Filter Profiles (${filterProfiles.length})`, icon: Shield },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-[11px] font-medium transition-colors border-b-2",
              activeTab === tab.id ? "bg-white text-[hsl(142,70%,35%)] border-[hsl(142,70%,35%)]" : "text-[#666] border-transparent hover:text-[#333] hover:bg-[#f0f0f0]"
            )}>
              <tab.icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          ))}
        </div>

        {/* General Settings */}
        {activeTab === 'general' && (
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="section">
                <div className="section-header"><span>DNS Server Settings</span></div>
                <div className="section-body space-y-4">
                  <div className="flex items-center justify-between p-3 bg-[#f5f5f5] border border-[#ddd]">
                    <div>
                      <div className="text-[11px] font-medium">Enable DNS Server</div>
                      <div className="text-[10px] text-[#666]">Enable local DNS server for network clients</div>
                    </div>
                    <FortiToggle enabled={dnsEnabled} onToggle={() => setDnsEnabled(!dnsEnabled)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="forti-label">Listen on Interface</label>
                      <select className="forti-select w-full"><option>LAN</option><option>DMZ</option><option>All Interfaces</option></select>
                    </div>
                    <div>
                      <label className="forti-label">DNS Port</label>
                      <input type="number" className="forti-input w-full" defaultValue="53" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="forti-label">Cache Size (entries)</label>
                      <input type="number" className="forti-input w-full" defaultValue="10000" />
                    </div>
                    <div>
                      <label className="forti-label">Cache TTL (seconds)</label>
                      <input type="number" className="forti-input w-full" defaultValue="3600" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 pt-2">
                    <label className="flex items-center gap-2 text-[11px]">
                      <input type="checkbox" className="forti-checkbox" defaultChecked /> Enable DNS Cache
                    </label>
                    <label className="flex items-center gap-2 text-[11px]">
                      <input type="checkbox" className="forti-checkbox" defaultChecked /> Log DNS Queries
                    </label>
                  </div>
                </div>
              </div>
              <div className="section">
                <div className="section-header"><span>DNS Statistics</span></div>
                <div className="section-body">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-3 bg-[#f5f5f5] border border-[#ddd] text-center">
                      <div className="text-2xl font-bold text-[hsl(142,70%,35%)]">{records.length}</div>
                      <div className="text-[10px] text-[#666]">Local Records</div>
                    </div>
                    <div className="p-3 bg-[#f5f5f5] border border-[#ddd] text-center">
                      <div className="text-2xl font-bold text-blue-600">{zones.length}</div>
                      <div className="text-[10px] text-[#666]">Forward Zones</div>
                    </div>
                  </div>
                  <table className="widget-table">
                    <tbody>
                      <tr><td className="widget-label">Forward Zones</td><td className="widget-value">{zones.length}</td></tr>
                      <tr><td className="widget-label">Local Records</td><td className="widget-value">{records.length}</td></tr>
                      <tr><td className="widget-label">Filter Profiles</td><td className="widget-value">{filterProfiles.length}</td></tr>
                      <tr><td className="widget-label">Runtime stats</td><td className="widget-value text-[#999]">available on Ubuntu</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Forward Zones */}
        {activeTab === 'forward' && (
          <div className="p-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-8">
                    <input type="checkbox" className="forti-checkbox"
                      checked={selectedZones.length === filteredZones.length && filteredZones.length > 0}
                      onChange={(e) => setSelectedZones(e.target.checked ? filteredZones.map(z => z.id) : [])} />
                  </th>
                  <th className="w-16">Status</th>
                  <th>Zone Name</th>
                  <th>Type</th>
                  <th>DNS Servers</th>
                  <th className="w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {zonesQ.isLoading && <tr><td colSpan={6} className="py-6 text-center text-[#999] text-[11px]"><Loader2 size={14} className="animate-spin inline mr-2" />Loading...</td></tr>}
                {!zonesQ.isLoading && filteredZones.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-[#999] text-[11px]">No forward zones. Click Create New → Forward Zone.</td></tr>}
                {filteredZones.map((zone) => (
                  <tr key={zone.id} className={cn(!zone.enabled && "opacity-60")}>
                    <td><input type="checkbox" className="forti-checkbox" checked={selectedZones.includes(zone.id)} onChange={(e) => setSelectedZones(e.target.checked ? [...selectedZones, zone.id] : selectedZones.filter(id => id !== zone.id))} /></td>
                    <td><FortiToggle enabled={zone.enabled} onToggle={() => toggleZone(zone)} size="sm" /></td>
                    <td className="text-[11px] font-medium">{zone.name}</td>
                    <td><span className="forti-tag bg-purple-100 text-purple-700 border-purple-200">FORWARD</span></td>
                    <td className="mono text-[10px]">{zone.servers.join(', ')}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button className="p-1 hover:bg-[#e0e0e0] rounded" onClick={() => handleEditZone(zone)}><Edit2 className="w-3 h-3 text-blue-600" /></button>
                        <button className="p-1 hover:bg-[#e0e0e0] rounded" onClick={() => setDeleteZoneId(zone.id)}><Trash2 className="w-3 h-3 text-red-600" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Local Records */}
        {activeTab === 'local' && (
          <div className="p-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-8">
                    <input type="checkbox" className="forti-checkbox"
                      checked={selectedRecords.length === filteredRecords.length && filteredRecords.length > 0}
                      onChange={(e) => setSelectedRecords(e.target.checked ? filteredRecords.map(r => r.id) : [])} />
                  </th>
                  <th className="w-16">Status</th>
                  <th>Hostname</th>
                  <th>Domain</th>
                  <th>Type</th>
                  <th>Address/Value</th>
                  <th>TTL</th>
                  <th className="w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recordsQ.isLoading && <tr><td colSpan={8} className="py-6 text-center text-[#999] text-[11px]"><Loader2 size={14} className="animate-spin inline mr-2" />Loading...</td></tr>}
                {!recordsQ.isLoading && filteredRecords.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-[#999] text-[11px]">No local records. Click Create New → Local Record.</td></tr>}
                {filteredRecords.map((record) => (
                  <tr key={record.id} className={cn(!record.enabled && "opacity-60")}>
                    <td><input type="checkbox" className="forti-checkbox" checked={selectedRecords.includes(record.id)} onChange={(e) => setSelectedRecords(e.target.checked ? [...selectedRecords, record.id] : selectedRecords.filter(id => id !== record.id))} /></td>
                    <td><FortiToggle enabled={record.enabled} onToggle={() => toggleRecord(record)} size="sm" /></td>
                    <td className="text-[11px] font-medium">{record.hostname}</td>
                    <td className="text-[11px]">{record.domain}</td>
                    <td>
                      <span className={cn("forti-tag font-mono",
                        record.type === 'A' ? "bg-green-100 text-green-700 border-green-200" :
                        record.type === 'CNAME' ? "bg-blue-100 text-blue-700 border-blue-200" :
                        record.type === 'MX' ? "bg-orange-100 text-orange-700 border-orange-200" :
                        "bg-gray-100 text-gray-700 border-gray-200")}>{record.type}</span>
                    </td>
                    <td className="mono text-[10px]">{record.address}</td>
                    <td className="text-[11px]">{record.ttl}s</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button className="p-1 hover:bg-[#e0e0e0] rounded" onClick={() => handleEditRecord(record)}><Edit2 className="w-3 h-3 text-blue-600" /></button>
                        <button className="p-1 hover:bg-[#e0e0e0] rounded" onClick={() => setDeleteRecordId(record.id)}><Trash2 className="w-3 h-3 text-red-600" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Filter Profiles */}
        {activeTab === 'filter' && (
          <div className="p-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-8">
                    <input type="checkbox" className="forti-checkbox"
                      checked={selectedFilters.length === filteredFilters.length && filteredFilters.length > 0}
                      onChange={(e) => setSelectedFilters(e.target.checked ? filteredFilters.map(f => f.id) : [])} />
                  </th>
                  <th className="w-16">Status</th>
                  <th>Profile Name</th>
                  <th>Domain Filter</th>
                  <th>Safe Search</th>
                  <th>Log Domains</th>
                  <th>Blocked Cats</th>
                  <th className="w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtersQ.isLoading && <tr><td colSpan={8} className="py-6 text-center text-[#999] text-[11px]"><Loader2 size={14} className="animate-spin inline mr-2" />Loading...</td></tr>}
                {!filtersQ.isLoading && filteredFilters.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-[#999] text-[11px]">No filter profiles. Click Create New → Filter Profile.</td></tr>}
                {filteredFilters.map((fp) => (
                  <tr key={fp.id} className={cn(!fp.enabled && "opacity-60")}>
                    <td><input type="checkbox" className="forti-checkbox" checked={selectedFilters.includes(fp.id)} onChange={(e) => setSelectedFilters(e.target.checked ? [...selectedFilters, fp.id] : selectedFilters.filter(id => id !== fp.id))} /></td>
                    <td><FortiToggle enabled={fp.enabled} onToggle={() => toggleFilter(fp)} size="sm" /></td>
                    <td className="text-[11px] font-medium">{fp.name}</td>
                    <td><span className={cn("forti-tag", fp.domain_filter ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500")}>{fp.domain_filter ? 'ON' : 'OFF'}</span></td>
                    <td><span className={cn("forti-tag", fp.safe_search ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-gray-100 text-gray-500")}>{fp.safe_search ? 'ON' : 'OFF'}</span></td>
                    <td><span className={cn("forti-tag", fp.log_all_domains ? "bg-orange-100 text-orange-700 border-orange-200" : "bg-gray-100 text-gray-500")}>{fp.log_all_domains ? 'ON' : 'OFF'}</span></td>
                    <td className="text-[11px]">{fp.blocked_categories}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button className="p-1 hover:bg-[#e0e0e0] rounded" onClick={() => handleEditFilter(fp)}><Edit2 className="w-3 h-3 text-blue-600" /></button>
                        <button className="p-1 hover:bg-[#e0e0e0] rounded" onClick={() => setDeleteFilterId(fp.id)}><Trash2 className="w-3 h-3 text-red-600" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Zone Modal */}
      <Dialog open={zoneModalOpen} onOpenChange={setZoneModalOpen}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle>{editingZone ? 'Edit Forward Zone' : 'Create Forward Zone'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="forti-label">Zone Name *</label>
              <input type="text" className="forti-input w-full" value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} placeholder="e.g., internal.corp" />
            </div>
            <div>
              <label className="forti-label">DNS Servers * (comma separated)</label>
              <input type="text" className="forti-input w-full" value={zoneForm.servers} onChange={(e) => setZoneForm({ ...zoneForm, servers: e.target.value })} placeholder="e.g., 8.8.8.8, 8.8.4.4" />
            </div>
            <div className="flex items-center gap-2">
              <FortiToggle enabled={zoneForm.enabled} onToggle={() => setZoneForm({ ...zoneForm, enabled: !zoneForm.enabled })} />
              <span className="text-[11px]">Enabled</span>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" size="sm" onClick={() => setZoneModalOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveZone} disabled={zoneMut.isPending}>
                {zoneMut.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Modal */}
      <Dialog open={recordModalOpen} onOpenChange={setRecordModalOpen}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle>{editingRecord ? 'Edit Local Record' : 'Create Local Record'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="forti-label">Hostname *</label>
                <input type="text" className="forti-input w-full" value={recordForm.hostname} onChange={(e) => setRecordForm({ ...recordForm, hostname: e.target.value })} placeholder="e.g., server01" />
              </div>
              <div>
                <label className="forti-label">Domain</label>
                <input type="text" className="forti-input w-full" value={recordForm.domain} onChange={(e) => setRecordForm({ ...recordForm, domain: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="forti-label">Record Type</label>
                <select className="forti-select w-full" value={recordForm.type} onChange={(e) => setRecordForm({ ...recordForm, type: e.target.value })}>
                  <option value="A">A</option><option value="AAAA">AAAA</option><option value="CNAME">CNAME</option><option value="MX">MX</option><option value="TXT">TXT</option>
                </select>
              </div>
              <div>
                <label className="forti-label">TTL (seconds)</label>
                <input type="number" className="forti-input w-full" value={recordForm.ttl} onChange={(e) => setRecordForm({ ...recordForm, ttl: parseInt(e.target.value) })} />
              </div>
            </div>
            <div>
              <label className="forti-label">Address/Value *</label>
              <input type="text" className="forti-input w-full" value={recordForm.address} onChange={(e) => setRecordForm({ ...recordForm, address: e.target.value })} placeholder="e.g., 192.168.1.10" />
            </div>
            <div className="flex items-center gap-2">
              <FortiToggle enabled={recordForm.enabled} onToggle={() => setRecordForm({ ...recordForm, enabled: !recordForm.enabled })} />
              <span className="text-[11px]">Enabled</span>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" size="sm" onClick={() => setRecordModalOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveRecord} disabled={recordMut.isPending}>
                {recordMut.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Filter Profile Modal */}
      <Dialog open={filterModalOpen} onOpenChange={setFilterModalOpen}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle>{editingFilter ? 'Edit Filter Profile' : 'Create Filter Profile'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="forti-label">Profile Name *</label>
              <input type="text" className="forti-input w-full" value={filterForm.name} onChange={(e) => setFilterForm({ ...filterForm, name: e.target.value })} placeholder="e.g., Block Malware" />
            </div>
            <div>
              <label className="forti-label">Comment</label>
              <input type="text" className="forti-input w-full" value={filterForm.comment} onChange={(e) => setFilterForm({ ...filterForm, comment: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'domain_filter', label: 'Domain Filter' },
                { key: 'safe_search', label: 'Safe Search' },
                { key: 'fortiguard_category', label: 'FortiGuard Categories' },
                { key: 'youtube_restrict', label: 'YouTube Restrict' },
                { key: 'log_all_domains', label: 'Log All Domains' },
                { key: 'enabled', label: 'Enabled' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-[11px] cursor-pointer">
                  <input type="checkbox" className="forti-checkbox"
                    checked={filterForm[key as keyof typeof filterForm] as boolean}
                    onChange={(e) => setFilterForm({ ...filterForm, [key]: e.target.checked })} />
                  {label}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" size="sm" onClick={() => setFilterModalOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveFilter} disabled={filterMut.isPending}>
                {filterMut.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialogs */}
      <AlertDialog open={!!deleteZoneId} onOpenChange={() => setDeleteZoneId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Forward Zone</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteZone} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!deleteRecordId} onOpenChange={() => setDeleteRecordId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Local Record</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteRecord} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!deleteFilterId} onOpenChange={() => setDeleteFilterId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Filter Profile</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteFilter} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
};

export default DNSServer;
