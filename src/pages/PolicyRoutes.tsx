import { Shell } from '@/components/layout/Shell';
import { Plus, Edit2, Trash2, RefreshCw, Search, Route, Copy, Download, Upload, X, GripVertical } from 'lucide-react';
import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePolicyRoutes } from '@/hooks/useDbData';
import { policyRoutesApi } from '@/lib/api';
import { FortiToggle } from '@/components/ui/forti-toggle';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
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

interface PolicyRoute {
  id: string;
  seq: number;
  incoming: string;
  source: string;
  destination: string;
  protocol: string;
  gateway: string;
  outInterface: string;
  status: 'enabled' | 'disabled';
  comment: string;
}

// Data loaded from database via usePolicyRoutes hook

const interfaces = ['wan1', 'wan2', 'internal', 'dmz', 'port1', 'port2', 'port3', 'port4'];
const protocols = ['any', 'TCP', 'UDP', 'ICMP', 'TCP/80', 'TCP/443', 'TCP/22', 'UDP/53'];

const PolicyRoutes = () => {
  const queryClient = useQueryClient();
  const { data: dbRoutes = [] } = usePolicyRoutes();

  const routes: PolicyRoute[] = (dbRoutes as any[]).map((r: any) => ({
    id: String(r.id),
    seq: r.seq ?? 0,
    incoming: r.incoming ?? '',
    source: r.source ?? '',
    destination: r.destination ?? '',
    protocol: r.protocol ?? 'any',
    gateway: r.gateway ?? '',
    outInterface: r.out_interface ?? r.outInterface ?? '',
    status: (r.status ?? 'enabled') as 'enabled' | 'disabled',
    comment: r.comment ?? '',
  }));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['policy-routes'] });

  const createMut = useMutation({ mutationFn: (d: any) => policyRoutesApi.create(d), onSuccess: invalidate });
  const updateMut = useMutation({ mutationFn: ({ id, ...d }: any) => policyRoutesApi.update(id, d), onSuccess: invalidate });
  const deleteMut = useMutation({ mutationFn: (id: any) => policyRoutesApi.delete(id), onSuccess: invalidate });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<PolicyRoute | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [routeToDelete, setRouteToDelete] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<Partial<PolicyRoute>>({
    seq: 1,
    incoming: 'internal',
    source: '',
    destination: '',
    protocol: 'any',
    gateway: '',
    outInterface: 'wan1',
    status: 'enabled',
    comment: '',
  });

  const toggleRoute = (id: string) => {
    const r = routes.find(x => x.id === id);
    if (!r) return;
    updateMut.mutate({ id, status: r.status === 'enabled' ? 'disabled' : 'enabled' }, {
      onSuccess: () => toast.success('Route status updated'),
    });
  };

  const handleCreate = () => {
    setEditingRoute(null);
    setFormData({
      seq: Math.max(...routes.map(r => r.seq), 0) + 1,
      incoming: 'internal',
      source: '',
      destination: '',
      protocol: 'any',
      gateway: '',
      outInterface: 'wan1',
      status: 'enabled',
      comment: '',
    });
    setShowModal(true);
  };

  const handleEdit = (route: PolicyRoute) => {
    setEditingRoute(route);
    setFormData(route);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formData.source || !formData.destination || !formData.gateway) {
      toast.error('Source, Destination and Gateway are required');
      return;
    }

    const dbPayload = {
      seq: formData.seq,
      incoming: formData.incoming,
      source: formData.source,
      destination: formData.destination,
      protocol: formData.protocol,
      gateway: formData.gateway,
      out_interface: formData.outInterface,
      status: formData.status,
      comment: formData.comment,
    };
    if (editingRoute) {
      updateMut.mutate({ id: editingRoute.id, ...dbPayload }, {
        onSuccess: () => { toast.success('Policy route updated'); setShowModal(false); },
        onError: () => toast.error('Failed to update route'),
      });
    } else {
      createMut.mutate(dbPayload, {
        onSuccess: () => { toast.success('Policy route created'); setShowModal(false); },
        onError: () => toast.error('Failed to create route'),
      });
    }
  };

  const handleDeleteConfirm = (id: string) => {
    setRouteToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = () => {
    if (routeToDelete) {
      deleteMut.mutate(routeToDelete, {
        onSuccess: () => {
          setSelectedIds(prev => prev.filter(id => id !== routeToDelete));
          toast.success('Policy route deleted');
        },
        onError: () => toast.error('Failed to delete route'),
      });
    }
    setDeleteConfirmOpen(false);
    setRouteToDelete(null);
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) {
      toast.error('Select routes to delete');
      return;
    }
    Promise.all(selectedIds.map(id => policyRoutesApi.delete(id)))
      .then(() => { setSelectedIds([]); invalidate(); toast.success(`${selectedIds.length} routes deleted`); })
      .catch(() => toast.error('Failed to delete some routes'));
  };

  const handleClone = (route: PolicyRoute) => {
    const maxSeq = Math.max(...routes.map(r => r.seq), 0);
    createMut.mutate({
      seq: maxSeq + 1,
      incoming: route.incoming,
      source: route.source,
      destination: route.destination,
      protocol: route.protocol,
      gateway: route.gateway,
      out_interface: route.outInterface,
      status: route.status,
      comment: `${route.comment} (Copy)`,
    }, { onSuccess: () => toast.success('Route cloned'), onError: () => toast.error('Failed to clone route') });
  };

  const handleExport = () => {
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      type: 'policy_routes',
      count: routes.length,
      data: routes,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `policy_routes-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${routes.length} policy routes`);
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
            const parsed = JSON.parse(e.target?.result as string);
            const data = parsed.data && Array.isArray(parsed.data) ? parsed.data : Array.isArray(parsed) ? parsed : null;
            if (!data) {
              toast.error('Invalid file format: expected an array or object with data property');
              return;
            }
            const newRoutes = data.map((r: any) => ({
              seq: r.seq,
              incoming: r.incoming,
              source: r.source,
              destination: r.destination,
              protocol: r.protocol,
              gateway: r.gateway,
              out_interface: r.outInterface ?? r.out_interface,
              status: r.status ?? 'enabled',
              comment: r.comment ?? '',
            }));
            Promise.all(newRoutes.map((r: any) => policyRoutesApi.create(r)))
              .then(() => { invalidate(); toast.success(`Imported ${newRoutes.length} policy routes`); })
              .catch(() => toast.error('Failed to import some routes'));
          } catch {
            toast.error('Failed to parse JSON file');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredRoutes.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRoutes.map(r => r.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const filteredRoutes = routes.filter(r => 
    r.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.comment.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.incoming.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => a.seq - b.seq);

  return (
    <Shell>
      <div className="space-y-0 animate-slide-in">
        {/* Toolbar */}
        <div className="forti-toolbar">
          <button className="forti-toolbar-btn primary" onClick={handleCreate}>
            <Plus className="w-3 h-3" />
            Create New
          </button>
          <button 
            className="forti-toolbar-btn" 
            onClick={() => selectedIds.length === 1 ? handleEdit(routes.find(r => r.id === selectedIds[0])!) : toast.error('Select one route to edit')}
          >
            <Edit2 className="w-3 h-3" />
            Edit
          </button>
          <button 
            className="forti-toolbar-btn" 
            onClick={() => selectedIds.length === 1 ? handleClone(routes.find(r => r.id === selectedIds[0])!) : toast.error('Select one route to clone')}
          >
            <Copy className="w-3 h-3" />
            Clone
          </button>
          <button className="forti-toolbar-btn text-red-600" onClick={handleBulkDelete}>
            <Trash2 className="w-3 h-3" />
            Delete
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
          <button className="forti-toolbar-btn" onClick={() => { invalidate(); toast.success('Routes refreshed'); }}>
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
          <div className="flex-1" />
          <div className="forti-search">
            <Search className="w-3 h-3 text-[#999]" />
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48"
            />
          </div>
        </div>

        {/* Table */}
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-8">
                <input 
                  type="checkbox" 
                  className="forti-checkbox"
                  checked={selectedIds.length === filteredRoutes.length && filteredRoutes.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="w-10">Seq</th>
              <th className="w-16">Status</th>
              <th>Incoming</th>
              <th>Source</th>
              <th>Destination</th>
              <th>Protocol</th>
              <th>Gateway</th>
              <th>Outgoing</th>
              <th>Comment</th>
              <th className="w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRoutes.map((route) => (
              <tr 
                key={route.id} 
                className={cn(
                  selectedIds.includes(route.id) && "selected",
                  route.status === 'disabled' && "opacity-60"
                )}
              >
                <td>
                  <input 
                    type="checkbox" 
                    className="forti-checkbox"
                    checked={selectedIds.includes(route.id)}
                    onChange={() => toggleSelect(route.id)}
                  />
                </td>
                <td className="text-[#111] font-medium">
                  <span className="flex items-center gap-1">
                    <GripVertical className="w-3 h-3 text-[#999] cursor-move" />
                    {route.seq}
                  </span>
                </td>
                <td>
                  <FortiToggle 
                    enabled={route.status === 'enabled'} 
                    onToggle={() => toggleRoute(route.id)}
                    size="sm"
                  />
                </td>
                <td>
                  <span className="forti-tag bg-blue-100 text-blue-700 border-blue-200">
                    {route.incoming}
                  </span>
                </td>
                <td className="mono text-[#111]">{route.source}</td>
                <td className="mono text-[#111]">{route.destination}</td>
                <td className="text-[#333]">{route.protocol}</td>
                <td className="mono text-[#111]">{route.gateway}</td>
                <td>
                  <span className="forti-tag bg-green-100 text-green-700 border-green-200">
                    {route.outInterface}
                  </span>
                </td>
                <td className="text-[#333]">{route.comment}</td>
                <td>
                  <div className="flex items-center gap-1">
                    <button 
                      className="p-1 hover:bg-[#f0f0f0]" 
                      onClick={() => handleEdit(route)}
                      title="Edit"
                    >
                      <Edit2 className="w-3 h-3 text-[#666]" />
                    </button>
                    <button 
                      className="p-1 hover:bg-[#f0f0f0]" 
                      onClick={() => handleDeleteConfirm(route.id)}
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#f5f5f5] border border-t-0 border-[#ddd] text-[11px] text-[#333]">
          <span>Total: {routes.length} policy routes</span>
          <span>Showing {filteredRoutes.length} of {routes.length}</span>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white border border-[#ccc] shadow-xl w-[600px]">
            <div className="forti-modal-header flex items-center justify-between">
              <span>{editingRoute ? 'Edit Policy Route' : 'Create Policy Route'}</span>
              <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="forti-modal-body space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="forti-label">Sequence Number</label>
                  <input
                    type="number"
                    className="forti-input w-full"
                    value={formData.seq || 1}
                    onChange={(e) => setFormData({ ...formData, seq: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="forti-label">Status</label>
                  <select
                    className="forti-select w-full"
                    value={formData.status || 'enabled'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'enabled' | 'disabled' })}
                  >
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
                <div>
                  <label className="forti-label">Protocol</label>
                  <select
                    className="forti-select w-full"
                    value={formData.protocol || 'any'}
                    onChange={(e) => setFormData({ ...formData, protocol: e.target.value })}
                  >
                    {protocols.map(proto => (
                      <option key={proto} value={proto}>{proto}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="forti-label">Incoming Interface *</label>
                  <select
                    className="forti-select w-full"
                    value={formData.incoming || 'internal'}
                    onChange={(e) => setFormData({ ...formData, incoming: e.target.value })}
                  >
                    {interfaces.map(iface => (
                      <option key={iface} value={iface}>{iface}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="forti-label">Outgoing Interface *</label>
                  <select
                    className="forti-select w-full"
                    value={formData.outInterface || 'wan1'}
                    onChange={(e) => setFormData({ ...formData, outInterface: e.target.value })}
                  >
                    {interfaces.map(iface => (
                      <option key={iface} value={iface}>{iface}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="forti-label">Source Address *</label>
                  <input
                    type="text"
                    className="forti-input w-full"
                    placeholder="10.0.1.0/24"
                    value={formData.source || ''}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  />
                </div>
                <div>
                  <label className="forti-label">Destination Address *</label>
                  <input
                    type="text"
                    className="forti-input w-full"
                    placeholder="0.0.0.0/0"
                    value={formData.destination || ''}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="forti-label">Gateway *</label>
                <input
                  type="text"
                  className="forti-input w-full"
                  placeholder="192.168.1.1"
                  value={formData.gateway || ''}
                  onChange={(e) => setFormData({ ...formData, gateway: e.target.value })}
                />
              </div>
              <div>
                <label className="forti-label">Comment</label>
                <input
                  type="text"
                  className="forti-input w-full"
                  placeholder="Description"
                  value={formData.comment || ''}
                  onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                />
              </div>
            </div>
            <div className="forti-modal-footer">
              <button className="forti-btn forti-btn-secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="forti-btn forti-btn-primary" onClick={handleSave}>
                {editingRoute ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Policy Route</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this policy route? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
};

export default PolicyRoutes;