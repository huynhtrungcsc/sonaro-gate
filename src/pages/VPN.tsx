import { useState } from 'react';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { formatBytes, formatUptimeShort as formatUptime } from '@/lib/formatters';
import {
  Plus,
  Trash2,
  Search,
  ChevronDown,
  RefreshCw,
  Play,
  Square,
  Shield,
  Key,
  Globe,
  Edit2,
  GripVertical
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useVPNTunnels } from '@/hooks/useDbData';
import { vpnTunnelsApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface SortableTunnelRowProps {
  tunnel: any;
  selectedRows: string[];
  toggleRowSelection: (id: string) => void;
  onConnect: (tunnel: any) => void;
  onDelete: (id: string) => void;
}

const SortableTunnelRow = ({ tunnel, selectedRows, toggleRowSelection, onConnect, onDelete }: SortableTunnelRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tunnel.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(selectedRows.includes(tunnel.id) && "selected", isDragging && "bg-blue-50")}
    >
      <td>
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-[#f0f0f0]">
          <GripVertical className="w-3 h-3 text-[#999]" />
        </button>
      </td>
      <td>
        <input
          type="checkbox"
          checked={selectedRows.includes(tunnel.id)}
          onChange={() => toggleRowSelection(tunnel.id)}
          className="forti-checkbox"
        />
      </td>
      <td>
        <span className={cn(
          "forti-status-dot",
          tunnel.status === 'connected' ? 'up' :
          tunnel.status === 'connecting' ? 'warning' : 'down'
        )} />
      </td>
      <td className="text-[11px] font-medium text-[#111]">{tunnel.name}</td>
      <td className="font-mono text-[10px] text-[#333]">{tunnel.remote_gateway}</td>
      <td className="font-mono text-[10px] text-[#666]">{tunnel.local_network || '—'}</td>
      <td className="font-mono text-[10px] text-[#666]">{tunnel.remote_network || '—'}</td>
      <td className="text-[11px]">{tunnel.uptime ? formatUptime(tunnel.uptime) : '—'}</td>
      <td>
        <div className="text-[10px]">
          <span className="text-green-600">↓{formatBytes(tunnel.bytes_in ?? 0)}</span>
          <span className="text-[#999] mx-1">/</span>
          <span className="text-blue-600">↑{formatBytes(tunnel.bytes_out ?? 0)}</span>
        </div>
      </td>
      <td>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onConnect(tunnel)}
            className={cn(
              "p-1 rounded transition-colors",
              tunnel.status === 'connected'
                ? "hover:bg-red-100 text-red-600"
                : "hover:bg-green-100 text-green-600"
            )}
            title={tunnel.status === 'connected' ? 'Bring Down' : 'Bring Up'}
          >
            {tunnel.status === 'connected' ? <Square size={12} /> : <Play size={12} />}
          </button>
          <button
            onClick={() => onDelete(tunnel.id)}
            className="p-1 rounded hover:bg-red-100 text-red-600 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </td>
    </tr>
  );
};

const VPN = () => {
  const [activeTab, setActiveTab] = useState<'ipsec' | 'monitor'>('ipsec');
  const [search, setSearch] = useState('');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [newTunnel, setNewTunnel] = useState({
    name: '',
    type: 'ipsec' as 'ipsec' | 'openvpn' | 'wireguard',
    remote_gateway: '',
    local_network: '',
    remote_network: '',
  });

  const queryClient = useQueryClient();
  const { data: tunnels = [], isLoading } = useVPNTunnels();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const createMut = useMutation({
    mutationFn: (data: any) => vpnTunnelsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vpn-tunnels'] });
      setModalOpen(false);
      setNewTunnel({ name: '', type: 'ipsec', remote_gateway: '', local_network: '', remote_network: '' });
      toast.success('VPN tunnel created');
    },
    onError: () => toast.error('Failed to create tunnel'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => vpnTunnelsApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vpn-tunnels'] }),
    onError: () => toast.error('Failed to update tunnel'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => vpnTunnelsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vpn-tunnels'] });
      setSelectedRows(prev => prev.filter(r => !deleteMut.variables || r !== deleteMut.variables));
      toast.success('VPN tunnel deleted');
    },
    onError: () => toast.error('Failed to delete tunnel'),
  });

  const filteredTunnels = (tunnels as any[]).filter(t => {
    if (activeTab === 'ipsec') return t.type === 'ipsec';
    return true;
  }).filter(t =>
    search === '' || (t.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const handleConnect = (tunnel: any) => {
    const newStatus = tunnel.status === 'connected' ? 'disconnected' : 'connecting';
    updateMut.mutate({ id: tunnel.id, data: { status: newStatus } });
    if (newStatus === 'connecting') {
      toast.info(`Connecting to ${tunnel.name}…`);
      setTimeout(() => {
        updateMut.mutate({ id: tunnel.id, data: { status: 'connected' } });
        toast.success(`Connected to ${tunnel.name}`);
      }, 2000);
    } else {
      toast.success(`Disconnected from ${tunnel.name}`);
    }
  };

  const handleDelete = (id: string) => {
    deleteMut.mutate(id);
    setSelectedRows(prev => prev.filter(r => r !== id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      toast.success('Order updated (UI only — persisted on next save)');
    }
  };

  const handleAddTunnel = () => {
    if (!newTunnel.name || !newTunnel.remote_gateway) {
      toast.error('Name and Remote Gateway are required');
      return;
    }
    createMut.mutate({
      name: newTunnel.name,
      type: newTunnel.type,
      status: 'disconnected',
      remote_gateway: newTunnel.remote_gateway,
      local_network: newTunnel.local_network || '192.168.1.0/24',
      remote_network: newTunnel.remote_network || '10.0.0.0/24',
      bytes_in: 0,
      bytes_out: 0,
      uptime: 0,
    });
  };

  const toggleRowSelection = (id: string) => {
    setSelectedRows(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const ipsecTotal = (tunnels as any[]).filter(t => t.type === 'ipsec').length;
  const ipsecUp = (tunnels as any[]).filter(t => t.type === 'ipsec' && t.status === 'connected').length;

  return (
    <Shell>
      <div className="space-y-0 animate-slide-in">
        <div className="forti-toolbar">
          <div className="relative">
            <button
              className="forti-toolbar-btn primary"
              onClick={() => setShowCreateMenu(!showCreateMenu)}
            >
              <Plus className="w-3 h-3" />
              Create New
              <ChevronDown className="w-3 h-3" />
            </button>
            {showCreateMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#ccc] shadow-lg z-50 min-w-[180px]">
                <button
                  onClick={() => { setNewTunnel(p => ({ ...p, type: 'ipsec' })); setModalOpen(true); setShowCreateMenu(false); }}
                  className="w-full px-3 py-2 text-left text-[11px] hover:bg-[#f0f0f0] flex items-center gap-2"
                >
                  <Shield className="w-3 h-3" />
                  IPsec Tunnel
                </button>
                <button
                  onClick={() => { setNewTunnel(p => ({ ...p, type: 'wireguard' })); setModalOpen(true); setShowCreateMenu(false); }}
                  className="w-full px-3 py-2 text-left text-[11px] hover:bg-[#f0f0f0] flex items-center gap-2"
                >
                  <Key className="w-3 h-3" />
                  WireGuard Tunnel
                </button>
              </div>
            )}
          </div>
          <button
            className="forti-toolbar-btn"
            disabled={selectedRows.length !== 1}
            onClick={() => toast.info('Tunnel editor not yet implemented')}
          >
            <Edit2 className="w-3 h-3" />
            Edit
          </button>
          <button
            className="forti-toolbar-btn"
            disabled={selectedRows.length === 0}
            onClick={() => {
              selectedRows.forEach(id => handleDelete(id));
              setSelectedRows([]);
            }}
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={() => queryClient.invalidateQueries({ queryKey: ['vpn-tunnels'] })}>
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
          <div className="flex-1" />
          <div className="forti-search">
            <Search className="w-3 h-3 text-[#999]" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-40"
            />
          </div>
        </div>

        <div className="px-3 py-1.5 bg-[#f5f5f5] border-b border-[#ddd] text-[11px] text-[#666] flex items-center gap-4">
          <span>IPsec Tunnels: <strong className="text-[#333]">{ipsecTotal}</strong></span>
          <span>Up: <strong className="text-green-700">{ipsecUp}</strong></span>
          <span>Down: <strong className="text-red-600">{ipsecTotal - ipsecUp}</strong></span>
        </div>

        <div className="flex items-center bg-[#e8e8e8] border-b border-[#ccc]">
          {[
            { id: 'ipsec', label: 'IPsec Tunnels', icon: Shield },
            { id: 'monitor', label: 'VPN Monitor', icon: Globe },
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

        {activeTab === 'ipsec' && (
          <div className="p-4">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-6"></th>
                    <th className="w-8"><input type="checkbox" className="forti-checkbox" /></th>
                    <th className="w-16">Status</th>
                    <th>Name</th>
                    <th>Remote Gateway</th>
                    <th>Local Network</th>
                    <th>Remote Network</th>
                    <th>Uptime</th>
                    <th>Traffic</th>
                    <th className="w-20">Actions</th>
                  </tr>
                </thead>
                <SortableContext items={filteredTunnels.map((t: any) => t.id)} strategy={verticalListSortingStrategy}>
                  <tbody>
                    {isLoading && (
                      <tr><td colSpan={10} className="text-center py-8 text-[#999] text-[11px]">Loading…</td></tr>
                    )}
                    {!isLoading && filteredTunnels.length === 0 && (
                      <tr><td colSpan={10} className="text-center py-8 text-[#999] text-[11px]">No VPN tunnels configured</td></tr>
                    )}
                    {filteredTunnels.map((tunnel: any) => (
                      <SortableTunnelRow
                        key={tunnel.id}
                        tunnel={tunnel}
                        selectedRows={selectedRows}
                        toggleRowSelection={toggleRowSelection}
                        onConnect={handleConnect}
                        onDelete={handleDelete}
                      />
                    ))}
                  </tbody>
                </SortableContext>
              </table>
            </DndContext>
            <div className="text-[11px] text-[#666] mt-2 px-1">
              {filteredTunnels.length} tunnel(s)
            </div>
          </div>
        )}

        {activeTab === 'monitor' && (
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="section">
                <div className="section-header">IPsec Tunnel Status</div>
                <div className="section-body">
                  <div className="space-y-2">
                    {(tunnels as any[]).filter(t => t.type === 'ipsec').map((tunnel: any) => (
                      <div key={tunnel.id} className="flex items-center justify-between p-2 bg-[#f8f8f8] border border-[#ddd]">
                        <div className="flex items-center gap-2">
                          <span className={cn("forti-status-dot", tunnel.status === 'connected' ? 'up' : 'down')} />
                          <span className="text-[11px] font-medium">{tunnel.name}</span>
                        </div>
                        <div className="text-[10px] text-[#666]">
                          {tunnel.status === 'connected' ? formatUptime(tunnel.uptime ?? 0) : 'Down'}
                        </div>
                      </div>
                    ))}
                    {(tunnels as any[]).filter(t => t.type === 'ipsec').length === 0 && (
                      <p className="text-[11px] text-[#999] py-4 text-center">No IPsec tunnels</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="section">
                <div className="section-header">VPN Summary</div>
                <div className="section-body">
                  <table className="widget-table">
                    <tbody>
                      <tr>
                        <td className="widget-label">Total Tunnels</td>
                        <td className="widget-value">{(tunnels as any[]).length}</td>
                      </tr>
                      <tr>
                        <td className="widget-label">Connected</td>
                        <td className="widget-value text-green-600">{(tunnels as any[]).filter(t => t.status === 'connected').length}</td>
                      </tr>
                      <tr>
                        <td className="widget-label">Disconnected</td>
                        <td className="widget-value text-red-600">{(tunnels as any[]).filter(t => t.status === 'disconnected').length}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <div className="forti-modal-header">
            <DialogTitle className="text-sm">Create {newTunnel.type === 'wireguard' ? 'WireGuard' : 'IPsec'} Tunnel</DialogTitle>
          </div>
          <div className="forti-modal-body space-y-4">
            <div>
              <label className="forti-label">Name</label>
              <input
                type="text"
                value={newTunnel.name}
                onChange={(e) => setNewTunnel({ ...newTunnel, name: e.target.value })}
                className="forti-input w-full"
                placeholder="Branch-Office-VPN"
              />
            </div>
            <div>
              <label className="forti-label">Remote Gateway</label>
              <input
                type="text"
                value={newTunnel.remote_gateway}
                onChange={(e) => setNewTunnel({ ...newTunnel, remote_gateway: e.target.value })}
                className="forti-input w-full"
                placeholder="203.113.152.1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="forti-label">Local Network</label>
                <input
                  type="text"
                  value={newTunnel.local_network}
                  onChange={(e) => setNewTunnel({ ...newTunnel, local_network: e.target.value })}
                  className="forti-input w-full"
                  placeholder="192.168.1.0/24"
                />
              </div>
              <div>
                <label className="forti-label">Remote Network</label>
                <input
                  type="text"
                  value={newTunnel.remote_network}
                  onChange={(e) => setNewTunnel({ ...newTunnel, remote_network: e.target.value })}
                  className="forti-input w-full"
                  placeholder="10.0.0.0/24"
                />
              </div>
            </div>
          </div>
          <div className="forti-modal-footer">
            <button onClick={() => setModalOpen(false)} className="forti-toolbar-btn">Cancel</button>
            <button onClick={handleAddTunnel} className="forti-toolbar-btn primary" disabled={createMut.isPending}>
              {createMut.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Shell>
  );
};

export default VPN;
