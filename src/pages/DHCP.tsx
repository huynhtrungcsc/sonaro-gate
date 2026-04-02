import { useState } from 'react';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { FortiToggle } from '@/components/ui/forti-toggle';
import { ChevronDown, Plus, RefreshCw, Search, Edit2, Trash2, Server, Network, Settings, X, Download, Upload, GripVertical, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { dhcpServersApi, dhcpStaticMappingsApi, dhcpLeasesApi } from '@/lib/api';

// DB schema uses snake_case
interface DHCPServer {
  id: string;
  interface: string;
  enabled: boolean;
  range_start: string;
  range_end: string;
  gateway: string;
  netmask: string;
  dns1: string;
  dns2: string;
  domain: string;
  lease_time: number;
  active_leases: number;
  total_pool: number;
  created_at?: string;
  updated_at?: string;
}

interface StaticMapping {
  id: string;
  name: string;
  mac: string;
  ip: string;
  interface: string;
  enabled: boolean;
  description: string;
  created_at?: string;
  updated_at?: string;
}

interface DhcpLease {
  id: string;
  ip: string;
  mac: string;
  hostname: string;
  lease_start: string;
  lease_end: string;
  status: string;
  interface: string;
}

const interfaceOptions = ['LAN', 'DMZ', 'WAN1', 'WAN2', 'Internal', 'Guest'];

interface SortableMappingRowProps {
  mapping: StaticMapping;
  onToggle: (mapping: StaticMapping) => void;
  onEdit: (mapping: StaticMapping) => void;
  onDelete: (type: 'server' | 'mapping', id: string) => void;
}

const SortableMappingRow = ({ mapping, onToggle, onEdit, onDelete }: SortableMappingRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: mapping.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <tr ref={setNodeRef} style={style} className={cn(!mapping.enabled && "opacity-60", isDragging && "bg-blue-50")}>
      <td><button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-[#f0f0f0]"><GripVertical className="w-3 h-3 text-[#999]" /></button></td>
      <td><input type="checkbox" className="forti-checkbox" /></td>
      <td><FortiToggle enabled={mapping.enabled} onToggle={() => onToggle(mapping)} size="sm" /></td>
      <td className="text-[11px] font-medium text-[#111]">{mapping.name}</td>
      <td className="mono text-[#111]">{mapping.ip}</td>
      <td className="mono text-[10px] text-[#333]">{mapping.mac}</td>
      <td><span className="forti-tag bg-blue-100 text-blue-700 border-blue-200">{mapping.interface}</span></td>
      <td className="text-[11px] text-[#333]">{mapping.description}</td>
      <td>
        <div className="flex items-center gap-1">
          <button className="p-1 hover:bg-[#f0f0f0]" onClick={() => onEdit(mapping)}><Edit2 className="w-3 h-3 text-[#666]" /></button>
          <button className="p-1 hover:bg-[#f0f0f0]" onClick={() => onDelete('mapping', mapping.id)}><Trash2 className="w-3 h-3 text-red-500" /></button>
        </div>
      </td>
    </tr>
  );
};

const DHCP = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'server' | 'leases' | 'static'>('server');
  const [searchQuery, setSearchQuery] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [showServerModal, setShowServerModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [editingServer, setEditingServer] = useState<DHCPServer | null>(null);
  const [editingMapping, setEditingMapping] = useState<StaticMapping | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'server' | 'mapping'; id: string } | null>(null);

  const [serverForm, setServerForm] = useState<Partial<DHCPServer>>({});
  const [mappingForm, setMappingForm] = useState<Partial<StaticMapping>>({});

  // Local drag-order state for mappings (UI-only, reset on refresh)
  const [mappingOrder, setMappingOrder] = useState<string[]>([]);

  // ── Queries ──────────────────────────────────────
  const serversQ = useQuery<DHCPServer[]>({
    queryKey: ['dhcp-servers', !!user],
    queryFn: () => dhcpServersApi.getAll() as Promise<DHCPServer[]>,
    enabled: !!user,
    refetchInterval: 30000,
  });
  const mappingsQ = useQuery<StaticMapping[]>({
    queryKey: ['dhcp-mappings', !!user],
    queryFn: async () => {
      const data = await dhcpStaticMappingsApi.getAll() as StaticMapping[];
      setMappingOrder(data.map(m => m.id));
      return data;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });
  const leasesQ = useQuery<DhcpLease[]>({
    queryKey: ['dhcp-leases', !!user],
    queryFn: () => dhcpLeasesApi.getAll() as Promise<DhcpLease[]>,
    enabled: !!user,
    refetchInterval: 30000,
  });

  const servers: DHCPServer[] = serversQ.data ?? [];
  const rawMappings: StaticMapping[] = mappingsQ.data ?? [];
  // Apply local drag order
  const mappings: StaticMapping[] = mappingOrder.length > 0
    ? mappingOrder.map(id => rawMappings.find(m => m.id === id)).filter(Boolean) as StaticMapping[]
    : rawMappings;
  const leases: DhcpLease[] = leasesQ.data ?? [];

  // ── Mutations ────────────────────────────────────
  const serverMut = useMutation({
    mutationFn: (args: { id?: string; data: Partial<DHCPServer> }) =>
      args.id ? dhcpServersApi.update(args.id, args.data) : dhcpServersApi.create(args.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dhcp-servers'] }),
  });
  const serverDelMut = useMutation({
    mutationFn: (id: string) => dhcpServersApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dhcp-servers'] }),
  });
  const mappingMut = useMutation({
    mutationFn: (args: { id?: string; data: Partial<StaticMapping> }) =>
      args.id ? dhcpStaticMappingsApi.update(args.id, args.data) : dhcpStaticMappingsApi.create(args.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dhcp-mappings'] }),
  });
  const mappingDelMut = useMutation({
    mutationFn: (id: string) => dhcpStaticMappingsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dhcp-mappings'] }),
  });

  // ── Toggle helpers ──────────────────────────────
  const toggleServer = (server: DHCPServer) => serverMut.mutate({ id: server.id, data: { enabled: !server.enabled } });
  const toggleMapping = (mapping: StaticMapping) => mappingMut.mutate({ id: mapping.id, data: { enabled: !mapping.enabled } });

  // ── Server CRUD ──────────────────────────────────
  const handleCreateServer = () => {
    setEditingServer(null);
    setServerForm({ interface: 'LAN', enabled: true, range_start: '', range_end: '', gateway: '', netmask: '255.255.255.0', dns1: '8.8.8.8', dns2: '8.8.4.4', domain: '', lease_time: 86400 });
    setShowServerModal(true);
  };
  const handleEditServer = (server: DHCPServer) => { setEditingServer(server); setServerForm(server); setShowServerModal(true); };
  const handleSaveServer = async () => {
    if (!serverForm.range_start || !serverForm.range_end || !serverForm.gateway) { toast.error('Address range and gateway are required'); return; }
    try {
      await serverMut.mutateAsync({ id: editingServer?.id, data: serverForm });
      toast.success(editingServer ? 'DHCP server updated' : 'DHCP server created');
      setShowServerModal(false);
    } catch { toast.error('Save failed'); }
  };

  // ── Mapping CRUD ─────────────────────────────────
  const handleCreateMapping = () => {
    setEditingMapping(null);
    setMappingForm({ name: '', mac: '', ip: '', interface: 'LAN', enabled: true, description: '' });
    setShowMappingModal(true);
  };
  const handleEditMapping = (mapping: StaticMapping) => { setEditingMapping(mapping); setMappingForm(mapping); setShowMappingModal(true); };
  const handleSaveMapping = async () => {
    if (!mappingForm.name || !mappingForm.mac || !mappingForm.ip) { toast.error('Name, MAC and IP are required'); return; }
    try {
      await mappingMut.mutateAsync({ id: editingMapping?.id, data: mappingForm });
      toast.success(editingMapping ? 'Static mapping updated' : 'Static mapping created');
      setShowMappingModal(false);
    } catch { toast.error('Save failed'); }
  };

  // ── Delete ───────────────────────────────────────
  const handleDeleteConfirm = (type: 'server' | 'mapping', id: string) => { setItemToDelete({ type, id }); setDeleteConfirmOpen(true); };
  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      if (itemToDelete.type === 'server') await serverDelMut.mutateAsync(itemToDelete.id);
      else await mappingDelMut.mutateAsync(itemToDelete.id);
      toast.success(`${itemToDelete.type === 'server' ? 'DHCP server' : 'Static mapping'} deleted`);
    } catch { toast.error('Delete failed'); }
    setDeleteConfirmOpen(false);
    setItemToDelete(null);
  };

  // ── Export/Import ────────────────────────────────
  const handleExport = () => {
    const data = { servers, mappings, leases };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dhcp-config-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    toast.success('DHCP configuration exported');
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dhcp-servers'] });
    queryClient.invalidateQueries({ queryKey: ['dhcp-mappings'] });
    queryClient.invalidateQueries({ queryKey: ['dhcp-leases'] });
    toast.success('Data refreshed from database');
  };

  // ── DnD ─────────────────────────────────────────
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setMappingOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
      toast.success('Order updated');
    }
  };

  const isLoading = serversQ.isLoading || mappingsQ.isLoading || leasesQ.isLoading;

  // Filtered
  const filteredServers = servers.filter(s => s.interface.toLowerCase().includes(searchQuery.toLowerCase()) || s.gateway.includes(searchQuery));
  const filteredMappings = mappings.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.ip.includes(searchQuery) || m.mac.includes(searchQuery));
  const filteredLeases = leases.filter(l => l.ip.includes(searchQuery) || l.mac.includes(searchQuery) || l.hostname.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <Shell>
      <div className="space-y-0 animate-slide-in">
        {/* Toolbar */}
        <div className="forti-toolbar">
          <button className="forti-toolbar-btn primary" onClick={activeTab === 'static' ? handleCreateMapping : handleCreateServer}>
            <Plus className="w-3 h-3" /> Create New
          </button>
          <button className="forti-toolbar-btn" disabled>
            <Edit2 className="w-3 h-3" /> Edit
          </button>
          <button className="forti-toolbar-btn text-red-600" disabled>
            <Trash2 className="w-3 h-3" /> Delete
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={handleExport}>
            <Download className="w-3 h-3" /> Export
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} /> Refresh
          </button>
          <div className="flex-1" />
          {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          <div className="forti-search">
            <Search className="w-3 h-3 text-[#999]" />
            <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-40" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center bg-[#e8e8e8] border-b border-[#ccc]">
          {[
            { id: 'server', label: `DHCP Servers (${servers.length})`, icon: Server },
            { id: 'leases', label: `Address Leases (${leases.length})`, icon: Network },
            { id: 'static', label: `Static Mappings (${mappings.length})`, icon: Settings },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-[11px] font-medium transition-colors border-b-2",
              activeTab === tab.id ? "bg-white text-[hsl(142,70%,35%)] border-[hsl(142,70%,35%)]" : "text-[#333] border-transparent hover:text-[#111] hover:bg-[#f0f0f0]"
            )}>
              <tab.icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          ))}
        </div>

        {/* DHCP Servers */}
        {activeTab === 'server' && (
          <div className="p-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-8"><input type="checkbox" className="forti-checkbox" /></th>
                  <th className="w-16">Status</th>
                  <th>Interface</th>
                  <th>Address Range</th>
                  <th>Gateway</th>
                  <th>DNS Servers</th>
                  <th>Domain</th>
                  <th>Lease Time</th>
                  <th>Pool Usage</th>
                  <th className="w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {serversQ.isLoading && <tr><td colSpan={10} className="py-6 text-center text-[#999] text-[11px]"><Loader2 size={14} className="animate-spin inline mr-2" />Loading...</td></tr>}
                {!serversQ.isLoading && filteredServers.length === 0 && <tr><td colSpan={10} className="py-6 text-center text-[#999] text-[11px]">No DHCP servers. Click Create New.</td></tr>}
                {filteredServers.map((server) => {
                  const usagePct = server.total_pool > 0 ? (server.active_leases / server.total_pool) : 0;
                  return (
                    <tr key={server.id} className={cn(!server.enabled && "opacity-60")}>
                      <td><input type="checkbox" className="forti-checkbox" /></td>
                      <td><FortiToggle enabled={server.enabled} onToggle={() => toggleServer(server)} size="sm" /></td>
                      <td><span className="text-[11px] px-2 py-0.5 bg-blue-100 text-blue-700 border border-blue-200">{server.interface}</span></td>
                      <td className="mono text-[#111]">{server.range_start} – {server.range_end}</td>
                      <td className="mono text-[#111]">{server.gateway}</td>
                      <td className="mono text-[10px] text-[#333]">{server.dns1}, {server.dns2}</td>
                      <td className="text-[11px] text-[#333]">{server.domain}</td>
                      <td className="text-[11px] text-[#333]">{server.lease_time}s</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="forti-progress w-20">
                            <div className={cn("forti-progress-bar", usagePct > 0.8 ? "red" : usagePct > 0.5 ? "orange" : "green")} style={{ width: `${usagePct * 100}%` }} />
                          </div>
                          <span className="text-[10px] text-[#333]">{server.active_leases}/{server.total_pool}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button className="p-1 hover:bg-[#f0f0f0]" onClick={() => handleEditServer(server)}><Edit2 className="w-3 h-3 text-[#666]" /></button>
                          <button className="p-1 hover:bg-[#f0f0f0]" onClick={() => handleDeleteConfirm('server', server.id)}><Trash2 className="w-3 h-3 text-red-500" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Leases */}
        {activeTab === 'leases' && (
          <div className="p-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-8"><input type="checkbox" className="forti-checkbox" /></th>
                  <th>IP Address</th>
                  <th>MAC Address</th>
                  <th>Hostname</th>
                  <th>Interface</th>
                  <th>Lease Start</th>
                  <th>Lease Expires</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {leasesQ.isLoading && <tr><td colSpan={8} className="py-6 text-center text-[#999] text-[11px]"><Loader2 size={14} className="animate-spin inline mr-2" />Loading...</td></tr>}
                {!leasesQ.isLoading && filteredLeases.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-[#999] text-[11px]">No active DHCP leases found in database.</td></tr>}
                {filteredLeases.map((lease) => (
                  <tr key={lease.id}>
                    <td><input type="checkbox" className="forti-checkbox" /></td>
                    <td className="mono text-[#111]">{lease.ip}</td>
                    <td className="mono text-[10px] text-[#333]">{lease.mac}</td>
                    <td className="text-[11px] text-[#333]">{lease.hostname || '—'}</td>
                    <td><span className="forti-tag bg-blue-100 text-blue-700 border-blue-200">{lease.interface}</span></td>
                    <td className="text-[10px] text-[#333]">{new Date(lease.lease_start).toLocaleString()}</td>
                    <td className="text-[10px] text-[#333]">{new Date(lease.lease_end).toLocaleString()}</td>
                    <td>
                      <div className="forti-status">
                        <span className={cn("forti-status-dot", lease.status === 'active' ? "up" : lease.status === 'expired' ? "down" : "warning")} />
                        <span className="capitalize text-[#333]">{lease.status}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Static Mappings */}
        {activeTab === 'static' && (
          <div className="p-4">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-6"></th>
                    <th className="w-8"><input type="checkbox" className="forti-checkbox" /></th>
                    <th className="w-16">Status</th>
                    <th>Name</th>
                    <th>IP Address</th>
                    <th>MAC Address</th>
                    <th>Interface</th>
                    <th>Description</th>
                    <th className="w-20">Actions</th>
                  </tr>
                </thead>
                <SortableContext items={mappings.map(m => m.id)} strategy={verticalListSortingStrategy}>
                  <tbody>
                    {mappingsQ.isLoading && <tr><td colSpan={9} className="py-6 text-center text-[#999] text-[11px]"><Loader2 size={14} className="animate-spin inline mr-2" />Loading...</td></tr>}
                    {!mappingsQ.isLoading && filteredMappings.length === 0 && <tr><td colSpan={9} className="py-6 text-center text-[#999] text-[11px]">No static mappings. Click Create New.</td></tr>}
                    {filteredMappings.map((mapping) => (
                      <SortableMappingRow
                        key={mapping.id}
                        mapping={mapping}
                        onToggle={toggleMapping}
                        onEdit={handleEditMapping}
                        onDelete={handleDeleteConfirm}
                      />
                    ))}
                  </tbody>
                </SortableContext>
              </table>
            </DndContext>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#f5f5f5] border border-t-0 border-[#ddd] text-[11px] text-[#333]">
          <span>
            {activeTab === 'server' && `Total: ${servers.length} DHCP servers`}
            {activeTab === 'leases' && `Total: ${leases.length} leases`}
            {activeTab === 'static' && `Total: ${mappings.length} static mappings`}
          </span>
        </div>
      </div>

      {/* Server Modal */}
      {showServerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white border border-[#ccc] shadow-xl w-[600px]">
            <div className="forti-modal-header flex items-center justify-between">
              <span>{editingServer ? 'Edit DHCP Server' : 'Create DHCP Server'}</span>
              <button onClick={() => setShowServerModal(false)} className="text-white/80 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="forti-modal-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="forti-label">Interface *</label>
                  <select className="forti-select w-full" value={serverForm.interface || 'LAN'} onChange={(e) => setServerForm({ ...serverForm, interface: e.target.value })}>
                    {interfaceOptions.map(iface => <option key={iface} value={iface}>{iface}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <FortiToggle enabled={serverForm.enabled ?? true} onToggle={() => setServerForm({ ...serverForm, enabled: !serverForm.enabled })} />
                  <span className="text-[11px] text-[#333]">Enable DHCP Server</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="forti-label">Range Start *</label>
                  <input type="text" className="forti-input w-full" placeholder="192.168.1.100" value={serverForm.range_start || ''} onChange={(e) => setServerForm({ ...serverForm, range_start: e.target.value })} />
                </div>
                <div>
                  <label className="forti-label">Range End *</label>
                  <input type="text" className="forti-input w-full" placeholder="192.168.1.200" value={serverForm.range_end || ''} onChange={(e) => setServerForm({ ...serverForm, range_end: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="forti-label">Gateway *</label>
                  <input type="text" className="forti-input w-full" placeholder="192.168.1.1" value={serverForm.gateway || ''} onChange={(e) => setServerForm({ ...serverForm, gateway: e.target.value })} />
                </div>
                <div>
                  <label className="forti-label">Netmask</label>
                  <input type="text" className="forti-input w-full" placeholder="255.255.255.0" value={serverForm.netmask || '255.255.255.0'} onChange={(e) => setServerForm({ ...serverForm, netmask: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="forti-label">DNS Server 1</label>
                  <input type="text" className="forti-input w-full" placeholder="8.8.8.8" value={serverForm.dns1 || '8.8.8.8'} onChange={(e) => setServerForm({ ...serverForm, dns1: e.target.value })} />
                </div>
                <div>
                  <label className="forti-label">DNS Server 2</label>
                  <input type="text" className="forti-input w-full" placeholder="8.8.4.4" value={serverForm.dns2 || '8.8.4.4'} onChange={(e) => setServerForm({ ...serverForm, dns2: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="forti-label">Domain Name</label>
                  <input type="text" className="forti-input w-full" placeholder="local.lan" value={serverForm.domain || ''} onChange={(e) => setServerForm({ ...serverForm, domain: e.target.value })} />
                </div>
                <div>
                  <label className="forti-label">Lease Time (seconds)</label>
                  <input type="number" className="forti-input w-full" value={serverForm.lease_time || 86400} onChange={(e) => setServerForm({ ...serverForm, lease_time: parseInt(e.target.value) })} />
                </div>
              </div>
            </div>
            <div className="forti-modal-footer">
              <button className="forti-btn forti-btn-secondary" onClick={() => setShowServerModal(false)}>Cancel</button>
              <button className="forti-btn forti-btn-primary" onClick={handleSaveServer} disabled={serverMut.isPending}>
                {serverMut.isPending ? 'Saving...' : (editingServer ? 'Update' : 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mapping Modal */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white border border-[#ccc] shadow-xl w-[500px]">
            <div className="forti-modal-header flex items-center justify-between">
              <span>{editingMapping ? 'Edit Static Mapping' : 'Create Static Mapping'}</span>
              <button onClick={() => setShowMappingModal(false)} className="text-white/80 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="forti-modal-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="forti-label">Name *</label>
                  <input type="text" className="forti-input w-full" placeholder="Server-Name" value={mappingForm.name || ''} onChange={(e) => setMappingForm({ ...mappingForm, name: e.target.value })} />
                </div>
                <div>
                  <label className="forti-label">Interface</label>
                  <select className="forti-select w-full" value={mappingForm.interface || 'LAN'} onChange={(e) => setMappingForm({ ...mappingForm, interface: e.target.value })}>
                    {interfaceOptions.map(iface => <option key={iface} value={iface}>{iface}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="forti-label">MAC Address *</label>
                  <input type="text" className="forti-input w-full" placeholder="00:1A:2B:3C:4D:5E" value={mappingForm.mac || ''} onChange={(e) => setMappingForm({ ...mappingForm, mac: e.target.value })} />
                </div>
                <div>
                  <label className="forti-label">IP Address *</label>
                  <input type="text" className="forti-input w-full" placeholder="192.168.1.10" value={mappingForm.ip || ''} onChange={(e) => setMappingForm({ ...mappingForm, ip: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="forti-label">Description</label>
                <input type="text" className="forti-input w-full" placeholder="Description" value={mappingForm.description || ''} onChange={(e) => setMappingForm({ ...mappingForm, description: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <FortiToggle enabled={mappingForm.enabled ?? true} onToggle={() => setMappingForm({ ...mappingForm, enabled: !mappingForm.enabled })} />
                <span className="text-[11px] text-[#333]">Enable Mapping</span>
              </div>
            </div>
            <div className="forti-modal-footer">
              <button className="forti-btn forti-btn-secondary" onClick={() => setShowMappingModal(false)}>Cancel</button>
              <button className="forti-btn forti-btn-primary" onClick={handleSaveMapping} disabled={mappingMut.isPending}>
                {mappingMut.isPending ? 'Saving...' : (editingMapping ? 'Update' : 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {itemToDelete?.type === 'server' ? 'DHCP Server' : 'Static Mapping'}</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
};

export default DHCP;
