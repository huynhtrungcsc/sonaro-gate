import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { formatBytes, formatUptimeShort as formatUptime } from '@/lib/formatters';
import {
  Plus, Trash2, Search, ChevronDown, RefreshCw, Play, Square,
  Shield, Key, Globe, Edit2, GripVertical, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useVPNTunnels } from '@/hooks/useDbData';
import { vpnTunnelsApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// ── Config helpers ────────────────────────────────────────────────
function parseConfig(tunnel: any): any {
  try { return JSON.parse(tunnel.config_json || '{}'); } catch { return {}; }
}

// ── Default form states ───────────────────────────────────────────
const defaultIPsec = {
  name: '', remote_gateway: '', local_network: '192.168.1.0/24',
  remote_network: '10.0.0.0/24', comment: '',
  ike_version: '2', auth_method: 'psk', psk: '',
  p1_enc: 'aes256', p1_hash: 'sha256', p1_dh: '14',
  p1_lifetime: '86400',
  p2_enc: 'aes256', p2_hash: 'sha256', p2_pfs: '14',
  p2_lifetime: '3600',
  dpd_action: 'restart', dpd_delay: '30', dpd_timeout: '150',
  nat_traversal: true,
};
const defaultWG = {
  name: '', local_network: '', comment: '',
  wg_listen_port: '51820', wg_private_key: '', wg_peer_public_key: '',
  wg_peer_endpoint: '', wg_allowed_ips: '0.0.0.0/0', wg_dns: '',
  wg_keepalive: '25',
};

type TunnelType = 'ipsec' | 'wireguard';

// ── Generate WireGuard keypair hint ──────────────────────────────
function genWgKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  return Array.from({ length: 43 }, () => chars[Math.floor(Math.random() * chars.length)]).join('') + '=';
}

// ── Sortable Row ─────────────────────────────────────────────────
const SortableTunnelRow = ({ tunnel, selectedRows, toggleRowSelection, onConnect, onDelete, onEdit }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tunnel.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <tr ref={setNodeRef} style={style} className={cn(selectedRows.includes(tunnel.id) && 'selected', isDragging && 'bg-blue-50')}>
      <td>
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-[#f0f0f0]">
          <GripVertical className="w-3 h-3 text-[#999]" />
        </button>
      </td>
      <td>
        <input type="checkbox" checked={selectedRows.includes(tunnel.id)} onChange={() => toggleRowSelection(tunnel.id)} className="forti-checkbox" />
      </td>
      <td>
        <span className={cn('forti-status-dot', tunnel.status === 'connected' ? 'up' : tunnel.status === 'connecting' ? 'warning' : 'down')} />
      </td>
      <td className="text-[11px] font-medium text-[#111]">{tunnel.name}</td>
      <td>
        <span className={cn('forti-tag text-[9px]', tunnel.type === 'wireguard' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-blue-100 text-blue-700 border-blue-200')}>
          {tunnel.type === 'wireguard' ? 'WireGuard' : 'IPsec'}
        </span>
      </td>
      <td className="font-mono text-[10px] text-[#333]">{tunnel.remote_gateway || '—'}</td>
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
          <button onClick={() => onEdit(tunnel)}
            className="p-1 rounded hover:bg-blue-100 text-blue-600 transition-colors" title="Edit">
            <Edit2 size={11} />
          </button>
          <button onClick={() => onConnect(tunnel)}
            className={cn('p-1 rounded transition-colors', tunnel.status === 'connected' ? 'hover:bg-red-100 text-red-600' : 'hover:bg-green-100 text-green-600')}
            title={tunnel.status === 'connected' ? 'Bring Down' : 'Bring Up'}>
            {tunnel.status === 'connected' ? <Square size={11} /> : <Play size={11} />}
          </button>
          <button onClick={() => onDelete(tunnel.id)} className="p-1 rounded hover:bg-red-100 text-red-600 transition-colors">
            <Trash2 size={11} />
          </button>
        </div>
      </td>
    </tr>
  );
};

// ── Main Component ────────────────────────────────────────────────
const VPN = () => {
  const location = useLocation();

  function tabFromPath(p: string): 'ipsec' | 'wireguard' | 'monitor' {
    if (p.includes('wireguard')) return 'wireguard';
    if (p.includes('monitor')) return 'monitor';
    return 'ipsec';
  }

  const [activeTab, setActiveTab] = useState<'ipsec' | 'wireguard' | 'monitor'>(tabFromPath(location.pathname));
  const [search, setSearch] = useState('');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<TunnelType>('ipsec');
  const [editingTunnel, setEditingTunnel] = useState<any | null>(null);
  const [ipsecForm, setIPsecForm] = useState(defaultIPsec);
  const [wgForm, setWgForm] = useState(defaultWG);
  const [localOrder, setLocalOrder] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);

  const queryClient = useQueryClient();
  const { data: tunnels = [], isLoading } = useVPNTunnels();

  // Sync tab when navigating directly via sidebar
  useEffect(() => {
    setActiveTab(tabFromPath(location.pathname));
  }, [location.pathname]);

  // Maintain local sort order (seeded from DB order)
  useEffect(() => {
    if ((tunnels as any[]).length > 0 && localOrder.length === 0) {
      setLocalOrder((tunnels as any[]).map((t: any) => t.id));
    }
  }, [tunnels]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const createMut = useMutation({
    mutationFn: (data: any) => vpnTunnelsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vpn-tunnels'] });
      setModalOpen(false);
      toast.success('VPN tunnel created and saved to database');
    },
    onError: () => toast.error('Failed to create tunnel'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => vpnTunnelsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vpn-tunnels'] });
      setModalOpen(false);
      setEditingTunnel(null);
    },
    onError: () => toast.error('Failed to update tunnel'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => vpnTunnelsApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vpn-tunnels'] }); toast.success('Tunnel deleted'); },
    onError: () => toast.error('Failed to delete tunnel'),
  });

  const openCreate = (type: TunnelType) => {
    setEditingTunnel(null);
    setModalType(type);
    if (type === 'ipsec') setIPsecForm(defaultIPsec);
    else setWgForm(defaultWG);
    setModalOpen(true);
    setShowCreateMenu(false);
  };

  const openEdit = (tunnel: any) => {
    const cfg = parseConfig(tunnel);
    setEditingTunnel(tunnel);
    if (tunnel.type === 'wireguard') {
      setModalType('wireguard');
      setWgForm({
        name: tunnel.name, local_network: tunnel.local_network || '',
        comment: tunnel.comment || '',
        wg_listen_port: cfg.wg_listen_port || '51820',
        wg_private_key: cfg.wg_private_key || '', wg_peer_public_key: cfg.wg_peer_public_key || '',
        wg_peer_endpoint: cfg.wg_peer_endpoint || '', wg_allowed_ips: cfg.wg_allowed_ips || '0.0.0.0/0',
        wg_dns: cfg.wg_dns || '', wg_keepalive: cfg.wg_keepalive || '25',
      });
    } else {
      setModalType('ipsec');
      setIPsecForm({
        name: tunnel.name, remote_gateway: tunnel.remote_gateway || '',
        local_network: tunnel.local_network || '', remote_network: tunnel.remote_network || '',
        comment: tunnel.comment || '',
        ike_version: cfg.ike_version || '2', auth_method: cfg.auth_method || 'psk',
        psk: cfg.psk || '', p1_enc: cfg.p1_enc || 'aes256', p1_hash: cfg.p1_hash || 'sha256',
        p1_dh: cfg.p1_dh || '14', p1_lifetime: cfg.p1_lifetime || '86400',
        p2_enc: cfg.p2_enc || 'aes256', p2_hash: cfg.p2_hash || 'sha256',
        p2_pfs: cfg.p2_pfs || '14', p2_lifetime: cfg.p2_lifetime || '3600',
        dpd_action: cfg.dpd_action || 'restart', dpd_delay: cfg.dpd_delay || '30',
        dpd_timeout: cfg.dpd_timeout || '150', nat_traversal: cfg.nat_traversal ?? true,
      });
    }
    setModalOpen(true);
  };

  const handleSave = () => {
    if (modalType === 'ipsec') {
      const f = ipsecForm;
      if (!f.name || !f.remote_gateway) { toast.error('Name and Remote Gateway are required'); return; }
      const { name, remote_gateway, local_network, remote_network, comment, ...cfg } = f;
      const payload = {
        name, type: 'ipsec', remote_gateway, local_network, remote_network, comment,
        config_json: JSON.stringify(cfg),
        status: editingTunnel?.status ?? 'disconnected',
        bytes_in: editingTunnel?.bytes_in ?? 0,
        bytes_out: editingTunnel?.bytes_out ?? 0,
        uptime: editingTunnel?.uptime ?? 0,
      };
      if (editingTunnel) updateMut.mutate({ id: editingTunnel.id, data: payload });
      else createMut.mutate(payload);
    } else {
      const f = wgForm;
      if (!f.name || !f.wg_peer_public_key || !f.wg_peer_endpoint) {
        toast.error('Name, Peer Public Key, and Peer Endpoint are required'); return;
      }
      const { name, local_network, comment, ...cfg } = f;
      const payload = {
        name, type: 'wireguard', local_network, comment,
        remote_gateway: f.wg_peer_endpoint.split(':')[0] || '',
        remote_network: f.wg_allowed_ips,
        config_json: JSON.stringify(cfg),
        status: editingTunnel?.status ?? 'disconnected',
        bytes_in: editingTunnel?.bytes_in ?? 0,
        bytes_out: editingTunnel?.bytes_out ?? 0,
        uptime: editingTunnel?.uptime ?? 0,
      };
      if (editingTunnel) updateMut.mutate({ id: editingTunnel.id, data: payload });
      else createMut.mutate(payload);
    }
  };

  const handleConnect = (tunnel: any) => {
    const newStatus = tunnel.status === 'connected' ? 'disconnected' : 'connecting';
    updateMut.mutate({ id: tunnel.id, data: { status: newStatus } });
    if (newStatus === 'connecting') {
      toast.info(`Bringing up ${tunnel.name}…`);
      setTimeout(() => {
        updateMut.mutate({ id: tunnel.id, data: { status: 'connected' } });
        toast.success(`${tunnel.name} connected`);
      }, 1800);
    } else {
      toast.success(`${tunnel.name} disconnected`);
    }
  };

  const handleDelete = (id: string) => {
    deleteMut.mutate(id);
    setSelectedRows(p => p.filter(r => r !== id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalOrder(prev => {
      const oldIdx = prev.indexOf(String(active.id));
      const newIdx = prev.indexOf(String(over.id));
      if (oldIdx < 0 || newIdx < 0) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const handleApplyConfig = async () => {
    setApplying(true);
    try {
      const token = localStorage.getItem('sonaro_token') ?? '';
      const res = await fetch('/api/vpn/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(data.message || 'VPN configuration applied to system');
      } else {
        toast.error(data.message || 'Failed to apply VPN configuration');
      }
    } catch {
      toast.error('Failed to reach server');
    } finally {
      setApplying(false);
    }
  };

  const toggleRowSelection = (id: string) =>
    setSelectedRows(p => p.includes(id) ? p.filter(r => r !== id) : [...p, id]);

  // Apply local drag-reorder, then filter by tab/search
  const orderedTunnels = localOrder.length > 0
    ? localOrder.map(id => (tunnels as any[]).find((t: any) => String(t.id) === id)).filter(Boolean)
    : (tunnels as any[]);

  const visibleTunnels = orderedTunnels.filter((t: any) => {
    if (activeTab === 'ipsec') return t.type === 'ipsec';
    if (activeTab === 'wireguard') return t.type === 'wireguard';
    return true;
  }).filter((t: any) => search === '' || t.name.toLowerCase().includes(search.toLowerCase()));

  const ipsecTotal = (tunnels as any[]).filter(t => t.type === 'ipsec').length;
  const ipsecUp = (tunnels as any[]).filter(t => t.type === 'ipsec' && t.status === 'connected').length;
  const wgTotal = (tunnels as any[]).filter(t => t.type === 'wireguard').length;
  const wgUp = (tunnels as any[]).filter(t => t.type === 'wireguard' && t.status === 'connected').length;

  const F = ipsecForm; const setF = (k: string, v: any) => setIPsecForm(p => ({ ...p, [k]: v }));
  const G = wgForm; const setG = (k: string, v: any) => setWgForm(p => ({ ...p, [k]: v }));

  return (
    <Shell>
      <div className="space-y-0 animate-slide-in">
        {/* Toolbar */}
        <div className="forti-toolbar">
          <div className="relative">
            <button className="forti-toolbar-btn primary" onClick={() => setShowCreateMenu(!showCreateMenu)}>
              <Plus className="w-3 h-3" />Create New<ChevronDown className="w-3 h-3" />
            </button>
            {showCreateMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#ccc] shadow-lg z-50 min-w-[180px]">
                <button onClick={() => openCreate('ipsec')} className="w-full px-3 py-2 text-left text-[11px] hover:bg-[#f0f0f0] flex items-center gap-2">
                  <Shield className="w-3 h-3" />IPsec Tunnel
                </button>
                <button onClick={() => openCreate('wireguard')} className="w-full px-3 py-2 text-left text-[11px] hover:bg-[#f0f0f0] flex items-center gap-2">
                  <Key className="w-3 h-3" />WireGuard Tunnel
                </button>
              </div>
            )}
          </div>
          <button className="forti-toolbar-btn" disabled={selectedRows.length !== 1}
            onClick={() => { const t = (tunnels as any[]).find(t => t.id === selectedRows[0]); if (t) openEdit(t); }}>
            <Edit2 className="w-3 h-3" />Edit
          </button>
          <button className="forti-toolbar-btn" disabled={selectedRows.length === 0}
            onClick={() => { selectedRows.forEach(id => handleDelete(id)); setSelectedRows([]); }}>
            <Trash2 className="w-3 h-3" />Delete
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={() => queryClient.invalidateQueries({ queryKey: ['vpn-tunnels'] })}>
            <RefreshCw className="w-3 h-3" />Refresh
          </button>
          <button className="forti-toolbar-btn primary" onClick={handleApplyConfig} disabled={applying}>
            <Play className="w-3 h-3" />{applying ? 'Applying…' : 'Apply Config to System'}
          </button>
          <div className="flex-1" />
          <div className="forti-search">
            <Search className="w-3 h-3 text-[#999]" />
            <input type="text" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-40" />
          </div>
        </div>

        {/* Stats strip */}
        <div className="px-3 py-1.5 bg-[#f5f5f5] border-b border-[#ddd] text-[11px] text-[#666] flex items-center gap-6">
          <span>IPsec: <strong className="text-[#333]">{ipsecTotal}</strong> total / <strong className="text-green-700">{ipsecUp}</strong> up</span>
          <span>WireGuard: <strong className="text-[#333]">{wgTotal}</strong> total / <strong className="text-green-700">{wgUp}</strong> up</span>
        </div>

        {/* Tabs */}
        <div className="flex items-center bg-[#e8e8e8] border-b border-[#ccc]">
          {[
            { id: 'ipsec', label: 'IPsec Tunnels', icon: Shield },
            { id: 'wireguard', label: 'WireGuard', icon: Key },
            { id: 'monitor', label: 'VPN Monitor', icon: Globe },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={cn('flex items-center gap-1.5 px-4 py-2 text-[11px] font-medium transition-colors border-b-2',
                activeTab === tab.id
                  ? 'bg-white text-[hsl(142,70%,35%)] border-[hsl(142,70%,35%)]'
                  : 'text-[#333] border-transparent hover:text-[#111] hover:bg-[#f0f0f0]')}>
              <tab.icon className="w-3.5 h-3.5" />{tab.label}
            </button>
          ))}
        </div>

        {/* IPsec / WireGuard tunnel table */}
        {activeTab !== 'monitor' && (
          <div className="p-4">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-6"></th>
                    <th className="w-8"><input type="checkbox" className="forti-checkbox" /></th>
                    <th className="w-12">Status</th>
                    <th>Name</th>
                    <th className="w-20">Type</th>
                    <th>Remote Gateway</th>
                    <th>Local Network</th>
                    <th>Remote Network</th>
                    <th>Uptime</th>
                    <th>Traffic</th>
                    <th className="w-24">Actions</th>
                  </tr>
                </thead>
                <SortableContext items={visibleTunnels.map((t: any) => t.id)} strategy={verticalListSortingStrategy}>
                  <tbody>
                    {isLoading && <tr><td colSpan={11} className="text-center py-8 text-[#999] text-[11px]">Loading…</td></tr>}
                    {!isLoading && visibleTunnels.length === 0 && (
                      <tr><td colSpan={11} className="text-center py-8 text-[#999] text-[11px]">
                        No {activeTab === 'wireguard' ? 'WireGuard' : 'IPsec'} tunnels configured — click Create New
                      </td></tr>
                    )}
                    {visibleTunnels.map((tunnel: any) => (
                      <SortableTunnelRow key={tunnel.id} tunnel={tunnel}
                        selectedRows={selectedRows} toggleRowSelection={toggleRowSelection}
                        onConnect={handleConnect} onDelete={handleDelete} onEdit={openEdit} />
                    ))}
                  </tbody>
                </SortableContext>
              </table>
            </DndContext>
            <div className="text-[11px] text-[#666] mt-2 px-1">{visibleTunnels.length} tunnel(s)</div>

            {/* Ubuntu install hint */}
            <div className="mt-3 p-3 bg-[#fff8e1] border border-[#ffe082] text-[10px] text-[#666] flex items-start gap-2">
              <Info size={12} className="text-[#f57c00] mt-0.5 shrink-0" />
              <div>
                <strong className="text-[#444]">Ubuntu 24.04 LTS deployment:</strong>
                {activeTab === 'wireguard'
                  ? ' Install WireGuard: apt-get install wireguard wireguard-tools — then apply config with wg-quick up wg0'
                  : ' Install strongSwan: apt-get install strongswan strongswan-pki — configuration written to /etc/ipsec.conf and /etc/ipsec.secrets on Apply'}
              </div>
            </div>
          </div>
        )}

        {/* VPN Monitor tab */}
        {activeTab === 'monitor' && (
          <div className="p-4 grid grid-cols-2 gap-4">
            <div className="section">
              <div className="section-header">IPsec Tunnels Status</div>
              <div className="section-body space-y-1">
                {(tunnels as any[]).filter(t => t.type === 'ipsec').map((tunnel: any) => (
                  <div key={tunnel.id} className="flex items-center justify-between p-2 bg-[#f8f8f8] border border-[#ddd]">
                    <div className="flex items-center gap-2">
                      <span className={cn('forti-status-dot', tunnel.status === 'connected' ? 'up' : 'down')} />
                      <div>
                        <span className="text-[11px] font-medium">{tunnel.name}</span>
                        <span className="text-[10px] text-[#999] ml-2 font-mono">{tunnel.remote_gateway}</span>
                      </div>
                    </div>
                    <div className="text-right text-[10px]">
                      <div className="text-[#666]">{tunnel.status === 'connected' ? formatUptime(tunnel.uptime ?? 0) : 'Down'}</div>
                      <div><span className="text-green-600">↓{formatBytes(tunnel.bytes_in ?? 0)}</span> / <span className="text-blue-600">↑{formatBytes(tunnel.bytes_out ?? 0)}</span></div>
                    </div>
                  </div>
                ))}
                {(tunnels as any[]).filter(t => t.type === 'ipsec').length === 0 && (
                  <p className="text-[11px] text-[#999] py-4 text-center">No IPsec tunnels</p>
                )}
              </div>
            </div>
            <div className="section">
              <div className="section-header">WireGuard Peers</div>
              <div className="section-body space-y-1">
                {(tunnels as any[]).filter(t => t.type === 'wireguard').map((tunnel: any) => (
                  <div key={tunnel.id} className="flex items-center justify-between p-2 bg-[#f8f8f8] border border-[#ddd]">
                    <div className="flex items-center gap-2">
                      <span className={cn('forti-status-dot', tunnel.status === 'connected' ? 'up' : 'down')} />
                      <span className="text-[11px] font-medium">{tunnel.name}</span>
                    </div>
                    <div className="text-[10px] text-[#666]">{tunnel.status === 'connected' ? 'Active' : 'Down'}</div>
                  </div>
                ))}
                {(tunnels as any[]).filter(t => t.type === 'wireguard').length === 0 && (
                  <p className="text-[11px] text-[#999] py-4 text-center">No WireGuard tunnels</p>
                )}
              </div>
            </div>
            <div className="section col-span-2">
              <div className="section-header">VPN Summary</div>
              <div className="section-body">
                <table className="widget-table">
                  <tbody>
                    <tr><td className="widget-label">Total Tunnels</td><td className="widget-value">{(tunnels as any[]).length}</td></tr>
                    <tr><td className="widget-label">Connected</td><td className="widget-value text-green-600">{(tunnels as any[]).filter(t => t.status === 'connected').length}</td></tr>
                    <tr><td className="widget-label">Disconnected</td><td className="widget-value text-red-600">{(tunnels as any[]).filter(t => t.status === 'disconnected').length}</td></tr>
                    <tr><td className="widget-label">Total Bytes In</td><td className="widget-value">{formatBytes((tunnels as any[]).reduce((s, t) => s + (t.bytes_in ?? 0), 0))}</td></tr>
                    <tr><td className="widget-label">Total Bytes Out</td><td className="widget-value">{formatBytes((tunnels as any[]).reduce((s, t) => s + (t.bytes_out ?? 0), 0))}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) { setModalOpen(false); setEditingTunnel(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          <div className="forti-modal-header">
            <DialogTitle className="text-sm">
              {editingTunnel ? 'Edit' : 'Create'} {modalType === 'wireguard' ? 'WireGuard' : 'IPsec'} Tunnel
            </DialogTitle>
          </div>

          {modalType === 'ipsec' ? (
            <div className="p-4 space-y-4 text-[11px]">
              {/* Basic */}
              <div className="section">
                <div className="section-header-neutral">Basic</div>
                <div className="p-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="forti-label">Tunnel Name *</label>
                    <input className="forti-input w-full" placeholder="Branch-Office-VPN" value={F.name} onChange={e => setF('name', e.target.value)} />
                  </div>
                  <div>
                    <label className="forti-label">Remote Gateway (IP/FQDN) *</label>
                    <input className="forti-input w-full" placeholder="203.113.152.1" value={F.remote_gateway} onChange={e => setF('remote_gateway', e.target.value)} />
                  </div>
                  <div>
                    <label className="forti-label">Local Network (CIDR)</label>
                    <input className="forti-input w-full" placeholder="192.168.1.0/24" value={F.local_network} onChange={e => setF('local_network', e.target.value)} />
                  </div>
                  <div>
                    <label className="forti-label">Remote Network (CIDR)</label>
                    <input className="forti-input w-full" placeholder="10.0.0.0/24" value={F.remote_network} onChange={e => setF('remote_network', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <label className="forti-label">Comment</label>
                    <input className="forti-input w-full" placeholder="Branch office VPN" value={F.comment} onChange={e => setF('comment', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Phase 1 */}
              <div className="section">
                <div className="section-header-neutral">Phase 1 (IKE)</div>
                <div className="p-3 grid grid-cols-3 gap-3">
                  <div>
                    <label className="forti-label">IKE Version</label>
                    <select className="forti-select w-full" value={F.ike_version} onChange={e => setF('ike_version', e.target.value)}>
                      <option value="1">IKEv1</option>
                      <option value="2">IKEv2</option>
                    </select>
                  </div>
                  <div>
                    <label className="forti-label">Auth Method</label>
                    <select className="forti-select w-full" value={F.auth_method} onChange={e => setF('auth_method', e.target.value)}>
                      <option value="psk">Pre-Shared Key</option>
                      <option value="rsa">RSA Certificate</option>
                    </select>
                  </div>
                  <div>
                    <label className="forti-label">Pre-Shared Key</label>
                    <input type="password" className="forti-input w-full" placeholder="Enter PSK" value={F.psk} onChange={e => setF('psk', e.target.value)} disabled={F.auth_method !== 'psk'} />
                  </div>
                  <div>
                    <label className="forti-label">Encryption</label>
                    <select className="forti-select w-full" value={F.p1_enc} onChange={e => setF('p1_enc', e.target.value)}>
                      <option value="aes256">AES-256</option>
                      <option value="aes128">AES-128</option>
                      <option value="3des">3DES</option>
                    </select>
                  </div>
                  <div>
                    <label className="forti-label">Hash Algorithm</label>
                    <select className="forti-select w-full" value={F.p1_hash} onChange={e => setF('p1_hash', e.target.value)}>
                      <option value="sha256">SHA-256</option>
                      <option value="sha384">SHA-384</option>
                      <option value="sha512">SHA-512</option>
                      <option value="sha1">SHA-1</option>
                    </select>
                  </div>
                  <div>
                    <label className="forti-label">DH Group</label>
                    <select className="forti-select w-full" value={F.p1_dh} onChange={e => setF('p1_dh', e.target.value)}>
                      <option value="5">Group 5 (1536-bit)</option>
                      <option value="14">Group 14 (2048-bit)</option>
                      <option value="19">Group 19 (256-bit ECP)</option>
                      <option value="20">Group 20 (384-bit ECP)</option>
                      <option value="21">Group 21 (521-bit ECP)</option>
                    </select>
                  </div>
                  <div>
                    <label className="forti-label">Lifetime (sec)</label>
                    <input type="number" className="forti-input w-full" value={F.p1_lifetime} onChange={e => setF('p1_lifetime', e.target.value)} />
                  </div>
                  <div className="col-span-2 flex items-center gap-2 mt-1">
                    <input type="checkbox" id="nat-t" checked={F.nat_traversal} onChange={e => setF('nat_traversal', e.target.checked)} className="accent-[hsl(142,70%,35%)]" />
                    <label htmlFor="nat-t" className="cursor-pointer">Enable NAT Traversal (NAT-T)</label>
                  </div>
                </div>
              </div>

              {/* Phase 2 */}
              <div className="section">
                <div className="section-header-neutral">Phase 2 (ESP)</div>
                <div className="p-3 grid grid-cols-4 gap-3">
                  <div>
                    <label className="forti-label">Encryption</label>
                    <select className="forti-select w-full" value={F.p2_enc} onChange={e => setF('p2_enc', e.target.value)}>
                      <option value="aes256">AES-256</option>
                      <option value="aes128">AES-128</option>
                      <option value="3des">3DES</option>
                    </select>
                  </div>
                  <div>
                    <label className="forti-label">Hash</label>
                    <select className="forti-select w-full" value={F.p2_hash} onChange={e => setF('p2_hash', e.target.value)}>
                      <option value="sha256">SHA-256</option>
                      <option value="sha384">SHA-384</option>
                      <option value="sha1">SHA-1</option>
                    </select>
                  </div>
                  <div>
                    <label className="forti-label">PFS Group</label>
                    <select className="forti-select w-full" value={F.p2_pfs} onChange={e => setF('p2_pfs', e.target.value)}>
                      <option value="0">Disabled</option>
                      <option value="5">Group 5</option>
                      <option value="14">Group 14</option>
                      <option value="19">Group 19</option>
                    </select>
                  </div>
                  <div>
                    <label className="forti-label">Lifetime (sec)</label>
                    <input type="number" className="forti-input w-full" value={F.p2_lifetime} onChange={e => setF('p2_lifetime', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* DPD */}
              <div className="section">
                <div className="section-header-neutral">Dead Peer Detection (DPD)</div>
                <div className="p-3 grid grid-cols-3 gap-3">
                  <div>
                    <label className="forti-label">DPD Action</label>
                    <select className="forti-select w-full" value={F.dpd_action} onChange={e => setF('dpd_action', e.target.value)}>
                      <option value="restart">Restart</option>
                      <option value="clear">Clear</option>
                      <option value="hold">Hold</option>
                      <option value="none">Disabled</option>
                    </select>
                  </div>
                  <div>
                    <label className="forti-label">DPD Delay (sec)</label>
                    <input type="number" className="forti-input w-full" value={F.dpd_delay} onChange={e => setF('dpd_delay', e.target.value)} />
                  </div>
                  <div>
                    <label className="forti-label">DPD Timeout (sec)</label>
                    <input type="number" className="forti-input w-full" value={F.dpd_timeout} onChange={e => setF('dpd_timeout', e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* WireGuard form */
            <div className="p-4 space-y-4 text-[11px]">
              <div className="section">
                <div className="section-header-neutral">WireGuard Interface</div>
                <div className="p-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="forti-label">Tunnel Name *</label>
                    <input className="forti-input w-full" placeholder="wg-branch" value={G.name} onChange={e => setG('name', e.target.value)} />
                  </div>
                  <div>
                    <label className="forti-label">Listen Port</label>
                    <input type="number" className="forti-input w-full" value={G.wg_listen_port} onChange={e => setG('wg_listen_port', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <label className="forti-label">Interface Address (CIDR — e.g. 10.8.0.1/24)</label>
                    <input className="forti-input w-full" placeholder="10.8.0.1/24" value={G.local_network} onChange={e => setG('local_network', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <label className="forti-label">Private Key (run: wg genkey | tee privatekey)</label>
                    <div className="flex gap-1">
                      <input type="password" className="forti-input flex-1" placeholder="Base64-encoded private key" value={G.wg_private_key} onChange={e => setG('wg_private_key', e.target.value)} />
                      <button className="forti-toolbar-btn text-[10px]" onClick={() => { const k = genWgKey(); setG('wg_private_key', k); toast.info('Placeholder key generated — replace with: wg genkey | tee /etc/wireguard/wg0.key'); }}>
                        Generate
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="forti-label">DNS Servers</label>
                    <input className="forti-input w-full" placeholder="1.1.1.1, 8.8.8.8" value={G.wg_dns} onChange={e => setG('wg_dns', e.target.value)} />
                  </div>
                  <div>
                    <label className="forti-label">Comment</label>
                    <input className="forti-input w-full" placeholder="Branch WireGuard" value={G.comment} onChange={e => setG('comment', e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="section">
                <div className="section-header-neutral">Peer Configuration</div>
                <div className="p-3 grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="forti-label">Peer Public Key *</label>
                    <input className="forti-input w-full font-mono text-[10px]" placeholder="Base64-encoded peer public key (wg pubkey < privatekey)" value={G.wg_peer_public_key} onChange={e => setG('wg_peer_public_key', e.target.value)} />
                  </div>
                  <div>
                    <label className="forti-label">Peer Endpoint (IP:Port) *</label>
                    <input className="forti-input w-full" placeholder="203.113.152.1:51820" value={G.wg_peer_endpoint} onChange={e => setG('wg_peer_endpoint', e.target.value)} />
                  </div>
                  <div>
                    <label className="forti-label">Allowed IPs</label>
                    <input className="forti-input w-full" placeholder="0.0.0.0/0 or 10.0.0.0/8" value={G.wg_allowed_ips} onChange={e => setG('wg_allowed_ips', e.target.value)} />
                  </div>
                  <div>
                    <label className="forti-label">Persistent Keepalive (sec)</label>
                    <input type="number" className="forti-input w-full" value={G.wg_keepalive} onChange={e => setG('wg_keepalive', e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="forti-modal-footer">
            <button onClick={() => { setModalOpen(false); setEditingTunnel(null); }} className="forti-toolbar-btn">Cancel</button>
            <button onClick={handleSave} className="forti-toolbar-btn primary" disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? 'Saving…' : editingTunnel ? 'Save Changes' : 'Create Tunnel'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Shell>
  );
};

export default VPN;
