import { useState } from 'react';
import { StatsBar } from '@/components/ui/stats-bar';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { FortiToggle } from '@/components/ui/forti-toggle';
import { 
  Router, 
  Plus, 
  Edit2, 
  Trash2, 
  Network,
  Globe,
  Search,
  RefreshCw,
  ChevronDown
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Route {
  id: string;
  destination: string;
  gateway: string;
  interface: string;
  metric: number;
  type: 'static' | 'connected' | 'dynamic';
  enabled: boolean;
  description: string;
}

const mockRoutes: Route[] = [
  { id: 'rt-1', destination: '0.0.0.0/0', gateway: '203.113.152.1', interface: 'WAN', metric: 1, type: 'static', enabled: true, description: 'Default gateway' },
  { id: 'rt-2', destination: '192.168.1.0/24', gateway: '', interface: 'LAN', metric: 0, type: 'connected', enabled: true, description: 'LAN network' },
  { id: 'rt-3', destination: '10.0.0.0/24', gateway: '', interface: 'DMZ', metric: 0, type: 'connected', enabled: true, description: 'DMZ network' },
  { id: 'rt-4', destination: '172.16.0.0/24', gateway: '', interface: 'GUEST', metric: 0, type: 'connected', enabled: true, description: 'Guest network' },
  { id: 'rt-5', destination: '192.168.2.0/24', gateway: '10.10.10.1', interface: 'WAN', metric: 10, type: 'static', enabled: true, description: 'Branch office via VPN' },
  { id: 'rt-6', destination: '10.100.0.0/16', gateway: '192.168.1.254', interface: 'LAN', metric: 20, type: 'static', enabled: false, description: 'Legacy network' },
];

const Routing = () => {
  const [routes, setRoutes] = useState<Route[]>(mockRoutes);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [filter, setFilter] = useState<'all' | 'static' | 'connected'>('all');
  const [search, setSearch] = useState('');
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [formData, setFormData] = useState({
    destination: '',
    gateway: '',
    interface: 'WAN',
    metric: 1,
    enabled: true,
    description: '',
  });

  const interfaces = ['WAN', 'LAN', 'DMZ', 'GUEST'];

  const filtered = routes.filter(r => {
    const matchesFilter = filter === 'all' || r.type === filter;
    const matchesSearch = search === '' || 
      r.destination.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleAdd = () => {
    setEditingRoute(null);
    setFormData({
      destination: '',
      gateway: '',
      interface: 'WAN',
      metric: 1,
      enabled: true,
      description: '',
    });
    setModalOpen(true);
    setShowCreateMenu(false);
  };

  const handleEdit = (route: Route) => {
    if (route.type === 'connected') {
      toast.error('Connected routes cannot be edited');
      return;
    }
    setEditingRoute(route);
    setFormData({
      destination: route.destination,
      gateway: route.gateway,
      interface: route.interface,
      metric: route.metric,
      enabled: route.enabled,
      description: route.description,
    });
    setModalOpen(true);
  };

  const handleDelete = (routeId: string) => {
    const route = routes.find(r => r.id === routeId);
    if (route?.type === 'connected') {
      toast.error('Connected routes cannot be deleted');
      return;
    }
    setRoutes(prev => prev.filter(r => r.id !== routeId));
    toast.success('Route deleted');
  };

  const toggleRoute = (id: string) => {
    const route = routes.find(r => r.id === id);
    if (route?.type === 'connected') return;
    setRoutes(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const onSubmit = () => {
    if (!formData.destination) {
      toast.error('Destination is required');
      return;
    }
    if (editingRoute) {
      setRoutes(prev => prev.map(r =>
        r.id === editingRoute.id ? { ...r, ...formData, type: 'static' } : r
      ));
      toast.success('Route updated');
    } else {
      const newRoute: Route = {
        id: `rt-${Date.now()}`,
        ...formData,
        type: 'static',
      };
      setRoutes(prev => [...prev, newRoute]);
      toast.success('Route created');
    }
    setModalOpen(false);
  };

  return (
    <Shell>
      <div className="space-y-0 animate-slide-in">
        {/* FortiGate Toolbar */}
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
                  onClick={handleAdd}
                  className="w-full px-3 py-2 text-left text-[11px] hover:bg-[#f0f0f0] flex items-center gap-2"
                >
                  <Router className="w-3 h-3" />
                  Static Route
                </button>
                <button className="w-full px-3 py-2 text-left text-[11px] hover:bg-[#f0f0f0] flex items-center gap-2">
                  <Network className="w-3 h-3" />
                  Policy Route
                </button>
              </div>
            )}
          </div>
          <button 
            className="forti-toolbar-btn" 
            disabled={!filtered.some(r => r.type === 'static')}
            onClick={() => {
              const selected = filtered.find(r => r.type === 'static');
              if (selected) handleEdit(selected);
              else toast.error('Select a static route to edit');
            }}
          >
            <Edit2 className="w-3 h-3" />
            Edit
          </button>
          <button 
            className="forti-toolbar-btn"
            onClick={() => toast.info('Select a route from the table to delete')}
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={() => { setRoutes(mockRoutes); toast.success('Routing table refreshed'); }}>
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

        {/* Stats Strip */}
        <StatsBar items={[
          { icon: Router, value: routes.filter(r => r.type === 'static').length, label: 'Static Routes', color: 'text-blue-500' },
          { icon: Network, value: routes.filter(r => r.type === 'connected').length, label: 'Connected', color: 'text-green-500' },
          { icon: Globe, value: routes.filter(r => r.enabled).length, label: 'Active', color: 'text-amber-500' },
        ]} />

        {/* Filter Tabs */}
        <div className="flex items-center bg-[#e8e8e8] border-b border-[#ccc]">
          {(['all', 'static', 'connected'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={cn(
                "px-4 py-2 text-[11px] font-medium transition-colors border-b-2 capitalize",
                filter === type 
                  ? "bg-white text-[hsl(142,70%,35%)] border-[hsl(142,70%,35%)]" 
                  : "text-[#666] border-transparent hover:text-[#333] hover:bg-[#f0f0f0]"
              )}
            >
              {type === 'all' ? 'All Routes' : type}
              <span className={cn(
                "ml-2 px-1.5 py-0.5 text-[10px] rounded",
                filter === type ? "bg-[hsl(142,70%,35%)]/20" : "bg-[#ddd]"
              )}>
                {type === 'all' ? routes.length : routes.filter(r => r.type === type).length}
              </span>
            </button>
          ))}
        </div>

        {/* Routes Table */}
        <div className="p-4">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-8">
                  <input type="checkbox" className="forti-checkbox" />
                </th>
                <th className="w-16">Status</th>
                <th>Destination</th>
                <th>Gateway</th>
                <th>Interface</th>
                <th className="w-20">Metric</th>
                <th className="w-28">Type</th>
                <th>Description</th>
                <th className="w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((route) => (
                <tr key={route.id} className={cn(!route.enabled && "opacity-60")}>
                  <td>
                    <input type="checkbox" className="forti-checkbox" />
                  </td>
                  <td>
                    {route.type === 'static' ? (
                      <FortiToggle 
                        enabled={route.enabled} 
                        onToggle={() => toggleRoute(route.id)}
                        size="sm"
                      />
                    ) : (
                      <span className="forti-status-dot up" />
                    )}
                  </td>
                  <td className="mono text-[11px]">{route.destination}</td>
                  <td className="mono text-[10px] text-[#666]">
                    {route.gateway || <span className="text-[#999]">—</span>}
                  </td>
                  <td>
                    <span className="forti-tag bg-blue-100 text-blue-700 border-blue-200">
                      {route.interface}
                    </span>
                  </td>
                  <td className="text-center text-[11px] text-[#666]">{route.metric}</td>
                  <td>
                    <span className={cn(
                      "forti-tag capitalize",
                      route.type === 'static' ? "bg-blue-100 text-blue-700 border-blue-200" :
                      route.type === 'connected' ? "bg-green-100 text-green-700 border-green-200" :
                      "bg-purple-100 text-purple-700 border-purple-200"
                    )}>
                      {route.type}
                    </span>
                  </td>
                  <td className="text-[11px] text-[#666]">{route.description}</td>
                  <td>
                    {route.type === 'static' && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(route)}
                          className="p-1 rounded hover:bg-[#e8e8e8] transition-colors"
                        >
                          <Edit2 size={12} className="text-[#666]" />
                        </button>
                        <button
                          onClick={() => handleDelete(route.id)}
                          className="p-1 rounded hover:bg-red-100 transition-colors"
                        >
                          <Trash2 size={12} className="text-red-500" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[11px] text-[#666] mt-2 px-1">
            {filtered.length} routes
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <div className="forti-modal-header">
            <DialogTitle className="text-sm">
              {editingRoute ? 'Edit Route' : 'Add Static Route'}
            </DialogTitle>
          </div>
          <div className="forti-modal-body space-y-4">
            <div>
              <label className="forti-label">Destination Network</label>
              <input
                type="text"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                className="forti-input w-full"
                placeholder="192.168.0.0/24"
              />
            </div>
            <div>
              <label className="forti-label">Gateway</label>
              <input
                type="text"
                value={formData.gateway}
                onChange={(e) => setFormData({ ...formData, gateway: e.target.value })}
                className="forti-input w-full"
                placeholder="10.0.0.1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="forti-label">Interface</label>
                <select 
                  value={formData.interface}
                  onChange={(e) => setFormData({ ...formData, interface: e.target.value })}
                  className="forti-select w-full"
                >
                  {interfaces.map(iface => (
                    <option key={iface} value={iface}>{iface}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="forti-label">Metric</label>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={formData.metric}
                  onChange={(e) => setFormData({ ...formData, metric: parseInt(e.target.value) || 0 })}
                  className="forti-input w-full"
                />
              </div>
            </div>
            <div>
              <label className="forti-label">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="forti-input w-full"
                placeholder="Optional description..."
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-[#f5f5f5] border border-[#ddd]">
              <span className="text-[11px]">Enable Route</span>
              <FortiToggle 
                enabled={formData.enabled} 
                onToggle={() => setFormData({ ...formData, enabled: !formData.enabled })}
              />
            </div>
          </div>
          <div className="forti-modal-footer">
            <button onClick={() => setModalOpen(false)} className="forti-btn forti-btn-secondary">
              Cancel
            </button>
            <button onClick={onSubmit} className="forti-btn forti-btn-primary">
              {editingRoute ? 'Save Changes' : 'Create Route'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Shell>
  );
};

export default Routing;
