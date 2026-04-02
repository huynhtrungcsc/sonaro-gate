import { useState } from 'react';
import { StatsBar } from '@/components/ui/stats-bar';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import {
  Plus,
  RefreshCw,
  ChevronDown,
  Search,
  Network,
  Server,
  Globe,
  Shield,
  Edit,
  Trash2,
  Wifi,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useInterfaces } from '@/hooks/useDashboardData';
import { networkInterfacesApi } from '@/lib/api';
import type { NetworkInterface } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { formatBytes } from '@/lib/formatters';

const Interfaces = () => {
  const queryClient = useQueryClient();
  const { data: rawIfaces = [], isLoading } = useInterfaces();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'type' | 'role' | 'alpha'>('type');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingInterface, setEditingInterface] = useState<NetworkInterface | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'LAN' as string,
    ip_address: '',
    subnet: '255.255.255.0',
    gateway: '',
    mtu: '1500',
    status: 'up' as string,
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['dashboard-interfaces'] });
    setIsRefreshing(false);
    toast.success('Interface statistics refreshed');
  };

  const handleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const openEditModal = (iface?: NetworkInterface) => {
    if (iface) {
      setEditingInterface(iface);
      setForm({
        name: iface.name,
        type: iface.type,
        ip_address: iface.ip_address ?? '',
        subnet: iface.subnet ?? '255.255.255.0',
        gateway: iface.gateway ?? '',
        mtu: String(iface.mtu ?? 1500),
        status: iface.status,
      });
    } else {
      setEditingInterface(null);
      setForm({
        name: '',
        type: 'LAN',
        ip_address: '',
        subnet: '255.255.255.0',
        gateway: '',
        mtu: '1500',
        status: 'up',
      });
    }
    setEditModalOpen(true);
  };

  const handleSaveInterface = async () => {
    if (!form.name.trim()) {
      toast.error('Interface name is required');
      return;
    }
    setIsSaving(true);
    try {
      const payload: Partial<NetworkInterface> = {
        name: form.name,
        type: form.type,
        ip_address: form.ip_address || null,
        subnet: form.subnet || null,
        gateway: form.gateway || null,
        mtu: parseInt(form.mtu) || 1500,
        status: form.status,
      };
      if (editingInterface) {
        await networkInterfacesApi.update(editingInterface.id, payload);
        toast.success('Interface updated');
      } else {
        await networkInterfacesApi.create(payload);
        toast.success('Interface created');
      }
      await queryClient.invalidateQueries({ queryKey: ['dashboard-interfaces'] });
      setEditModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message ?? 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    const protectedIds = rawIfaces
      .filter(i => i.type === 'WAN' || i.type === 'LAN')
      .map(i => i.id);
    const deletable = selectedIds.filter(id => !protectedIds.includes(id));

    if (deletable.length === 0) {
      toast.error('Cannot delete WAN/LAN interfaces');
      setDeleteDialogOpen(false);
      return;
    }
    try {
      await networkInterfacesApi.deleteMany(deletable);
      await queryClient.invalidateQueries({ queryKey: ['dashboard-interfaces'] });
      setSelectedIds([]);
      toast.success(`${deletable.length} interface(s) deleted`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Delete failed');
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  const sorted = [...rawIfaces].sort((a, b) => {
    if (viewMode === 'alpha') return a.name.localeCompare(b.name);
    if (viewMode === 'type') {
      const order: Record<string, number> = { WAN: 0, LAN: 1, DMZ: 2, OPT: 3 };
      return (order[a.type] ?? 9) - (order[b.type] ?? 9);
    }
    return a.name.localeCompare(b.name);
  });

  const filteredInterfaces = sorted.filter(i =>
    searchQuery === '' ||
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (i.ip_address ?? '').includes(searchQuery)
  );

  const selectedInterface = selectedIds.length === 1
    ? rawIfaces.find(i => i.id === selectedIds[0])
    : null;

  const stats = {
    total: rawIfaces.length,
    up: rawIfaces.filter(i => i.status === 'up').length,
    down: rawIfaces.filter(i => i.status !== 'up').length,
    wan: rawIfaces.filter(i => i.type === 'WAN').length,
    lan: rawIfaces.filter(i => i.type === 'LAN').length,
  };

  return (
    <Shell>
      <div className="space-y-0">
        {/* Header */}
        <div className="section-header-neutral">
          <div className="flex items-center gap-2">
            <Network size={14} />
            <span className="font-semibold">Interfaces</span>
          </div>
          {isLoading && <Loader2 size={13} className="animate-spin text-muted-foreground" />}
        </div>

        {/* Toolbar */}
        <div className="forti-toolbar">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="forti-toolbar-btn primary">
                <Plus size={12} /> Create New <ChevronDown size={10} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 bg-white border border-[#ccc]">
              <DropdownMenuItem onClick={() => openEditModal()} className="text-[11px] gap-2">
                <Network size={12} /> Interface
              </DropdownMenuItem>
              <DropdownMenuItem className="text-[11px] gap-2">
                <Server size={12} /> VLAN
              </DropdownMenuItem>
              <DropdownMenuItem className="text-[11px] gap-2">
                <Globe size={12} /> Loopback Interface
              </DropdownMenuItem>
              <DropdownMenuItem className="text-[11px] gap-2">
                <Wifi size={12} /> Zone
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={() => selectedInterface && openEditModal(selectedInterface)}
            className="forti-toolbar-btn"
            disabled={selectedIds.length !== 1}
          >
            <Edit size={12} /> Edit
          </button>
          <button
            onClick={() => setDeleteDialogOpen(true)}
            className="forti-toolbar-btn"
            disabled={selectedIds.length === 0}
          >
            <Trash2 size={12} /> Delete
          </button>
          <div className="forti-toolbar-separator" />
          <button onClick={handleRefresh} className="forti-toolbar-btn" disabled={isRefreshing}>
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} /> Refresh
          </button>

          <div className="flex-1" />

          <div className="forti-view-toggle mr-2">
            <button className={cn("forti-view-btn", viewMode === 'type' && "active")} onClick={() => setViewMode('type')}>By Type</button>
            <button className={cn("forti-view-btn", viewMode === 'role' && "active")} onClick={() => setViewMode('role')}>By Role</button>
            <button className={cn("forti-view-btn", viewMode === 'alpha' && "active")} onClick={() => setViewMode('alpha')}>Alphabetically</button>
          </div>

          <div className="forti-search">
            <Search size={12} className="text-[#999]" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Stats Bar */}
        <StatsBar items={[
          { value: stats.total, label: 'Total' },
          { iconNode: <div className="w-2.5 h-2.5 rounded-full bg-green-500" />, value: stats.up, label: 'Up', color: 'text-green-600' },
          { iconNode: <div className="w-2.5 h-2.5 rounded-full bg-red-500" />, value: stats.down, label: 'Down', color: 'text-red-600' },
          { value: stats.wan, label: 'WAN', color: 'text-blue-600' },
          { value: stats.lan, label: 'LAN', color: 'text-purple-600' },
        ]} />

        {/* Port Visualization */}
        <div className="bg-white border-x border-b border-[#ddd] py-3 flex justify-center">
          <div className="bg-[#333] rounded px-6 py-3 text-center">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={14} className="text-[#4caf50]" />
              <span className="text-[11px] text-gray-400">SONARO</span>
              <span className="text-[11px] text-white font-bold">GATE</span>
            </div>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 10 }, (_, i) => {
                const isUp = i < stats.up;
                return (
                  <div
                    key={i}
                    className={cn(
                      "w-5 h-5 border text-[8px] font-bold flex items-center justify-center",
                      isUp
                        ? "bg-[#4caf50] border-[#388e3c] text-white"
                        : "bg-[#666] border-[#444] text-[#999]"
                    )}
                  >
                    {i + 1}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Interface Table */}
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-10">Status</th>
              <th>Name</th>
              <th>MAC</th>
              <th>IP / Mask</th>
              <th>Type</th>
              <th>Speed</th>
              <th className="text-right">RX / TX</th>
            </tr>
          </thead>
          <tbody>
            <tr className="group-header">
              <td colSpan={7} className="py-1 px-2">
                <div className="flex items-center gap-2">
                  <ChevronDown size={12} />
                  <span>Physical ({filteredInterfaces.length})</span>
                </div>
              </td>
            </tr>

            {isLoading && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-[#999] text-[11px]">
                  <Loader2 size={14} className="animate-spin inline mr-2" />Loading interfaces from system...
                </td>
              </tr>
            )}

            {!isLoading && filteredInterfaces.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-[#999] text-[11px]">
                  No interfaces detected — system agent will populate this table automatically.
                </td>
              </tr>
            )}

            {filteredInterfaces.map((iface) => (
              <tr
                key={iface.id}
                onClick={() => handleSelect(iface.id)}
                className={cn("cursor-pointer", selectedIds.includes(iface.id) && "bg-[#fff8e1]")}
              >
                <td>
                  <span className={cn(
                    "inline-flex items-center justify-center w-5 h-5 rounded-sm text-[10px] font-bold",
                    iface.status === 'up'
                      ? 'bg-[#4caf50] text-white'
                      : 'bg-[#ccc] text-[#666]'
                  )}>
                    {iface.status === 'up' ? '⬆' : '⬇'}
                  </span>
                </td>
                <td className="font-medium text-[#111]">
                  {iface.name}
                  <span className={cn(
                    "ml-2 text-[9px] font-bold px-1 rounded uppercase",
                    iface.type === 'WAN' ? 'bg-blue-100 text-blue-700' :
                    iface.type === 'LAN' ? 'bg-purple-100 text-purple-700' :
                    'bg-gray-100 text-gray-600'
                  )}>{iface.type}</span>
                </td>
                <td className="font-mono text-[10px] text-[#666]">{iface.mac ?? '—'}</td>
                <td className="mono text-[#333]">
                  {iface.ip_address
                    ? `${iface.ip_address}${iface.subnet ? ` / ${iface.subnet}` : ''}`
                    : <span className="text-[#aaa]">—</span>
                  }
                </td>
                <td>
                  <span className="inline-flex items-center gap-1 text-[#333]">
                    <Network size={12} className="text-[#666]" />
                    Physical Interface
                  </span>
                </td>
                <td className="text-[#666]">{iface.speed ?? '—'}</td>
                <td className="text-right text-[#666] font-mono text-[10px]">
                  {formatBytes(iface.rx_bytes ?? 0)} / {formatBytes(iface.tx_bytes ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Interface Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="forti-modal-header">
            <DialogTitle className="text-sm font-semibold">
              {editingInterface ? 'Edit Interface' : 'Create Interface'}
            </DialogTitle>
          </DialogHeader>

          <div className="forti-modal-body space-y-4">
            <div className="grid grid-cols-3 gap-3 items-center">
              <Label className="forti-label text-right">Interface Name</Label>
              <div className="col-span-2">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="forti-input w-full"
                  placeholder="eth0"
                  disabled={!!editingInterface}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 items-center">
              <Label className="forti-label text-right">Type</Label>
              <div className="col-span-2">
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="forti-select w-full"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white border border-[#ccc]">
                    <SelectItem value="WAN">WAN</SelectItem>
                    <SelectItem value="LAN">LAN</SelectItem>
                    <SelectItem value="DMZ">DMZ</SelectItem>
                    <SelectItem value="OPT">OPT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 items-center">
              <Label className="forti-label text-right">Status</Label>
              <div className="col-span-2">
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="forti-select w-full"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white border border-[#ccc]">
                    <SelectItem value="up">Up</SelectItem>
                    <SelectItem value="down">Down</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 items-center">
              <Label className="forti-label text-right">IP Address</Label>
              <div className="col-span-2">
                <Input
                  value={form.ip_address}
                  onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
                  className="forti-input w-full"
                  placeholder="192.168.1.1"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 items-center">
              <Label className="forti-label text-right">Subnet Mask</Label>
              <div className="col-span-2">
                <Input
                  value={form.subnet}
                  onChange={(e) => setForm({ ...form, subnet: e.target.value })}
                  className="forti-input w-full"
                  placeholder="255.255.255.0"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 items-center">
              <Label className="forti-label text-right">Gateway</Label>
              <div className="col-span-2">
                <Input
                  value={form.gateway}
                  onChange={(e) => setForm({ ...form, gateway: e.target.value })}
                  className="forti-input w-full"
                  placeholder="192.168.1.254"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 items-center">
              <Label className="forti-label text-right">MTU</Label>
              <div className="col-span-2">
                <Input
                  value={form.mtu}
                  onChange={(e) => setForm({ ...form, mtu: e.target.value })}
                  className="forti-input w-full"
                  placeholder="1500"
                />
              </div>
            </div>
          </div>

          <div className="forti-modal-footer">
            <button onClick={() => setEditModalOpen(false)} className="forti-btn forti-btn-secondary">Cancel</button>
            <button onClick={handleSaveInterface} className="forti-btn forti-btn-primary" disabled={isSaving}>
              {isSaving ? <Loader2 size={12} className="animate-spin" /> : 'OK'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Interface(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.length} interface(s)? WAN/LAN interfaces cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
};

export default Interfaces;
