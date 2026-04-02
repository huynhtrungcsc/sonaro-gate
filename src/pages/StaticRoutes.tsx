import { Shell } from '@/components/layout/Shell';
import { Plus, Edit2, Trash2, RefreshCw, Search, ArrowRight, Copy, Download, X } from 'lucide-react';
import { useState } from 'react';
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
import { useStaticRoutes } from '@/hooks/useDbData';
import { staticRoutesApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNetworkInterfaces } from '@/hooks/useDbData';

interface RouteForm {
  destination: string;
  gateway: string;
  interface: string;
  distance: number;
  priority: number;
  status: 'enabled' | 'disabled';
  comment: string;
}

const BLANK_FORM: RouteForm = {
  destination: '',
  gateway: '',
  interface: 'wan1',
  distance: 10,
  priority: 0,
  status: 'enabled',
  comment: '',
};

const StaticRoutes = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [routeToDelete, setRouteToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState<RouteForm>(BLANK_FORM);

  const queryClient = useQueryClient();
  const { data: routes = [], isLoading } = useStaticRoutes();
  const { data: ifaces = [] } = useNetworkInterfaces();

  const ifaceNames: string[] = ifaces.length > 0
    ? (ifaces as any[]).map((i: any) => i.name)
    : ['wan1', 'wan2', 'internal', 'dmz'];

  const saveMut = useMutation({
    mutationFn: (args: { id?: string; data: Partial<RouteForm> }) =>
      args.id ? staticRoutesApi.update(args.id, args.data as any) : staticRoutesApi.create(args.data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['static-routes'] });
      setShowModal(false);
      toast.success(editingId ? 'Route updated' : 'Route created');
      setEditingId(null);
    },
    onError: () => toast.error('Failed to save route'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => staticRoutesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['static-routes'] });
      setSelectedIds(prev => prev.filter(i => i !== routeToDelete));
      setDeleteConfirmOpen(false);
      setRouteToDelete(null);
      toast.success('Route deleted');
    },
    onError: () => toast.error('Failed to delete route'),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      staticRoutesApi.update(id, { status } as any),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['static-routes'] }),
    onError: () => toast.error('Failed to update route'),
  });

  const handleCreate = () => {
    setEditingId(null);
    setFormData(BLANK_FORM);
    setShowModal(true);
  };

  const handleEdit = (route: any) => {
    setEditingId(route.id);
    setFormData({
      destination: route.destination,
      gateway: route.gateway,
      interface: route.interface,
      distance: route.distance,
      priority: route.priority,
      status: route.status,
      comment: route.comment,
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formData.destination || !formData.gateway) {
      toast.error('Destination and Gateway are required');
      return;
    }
    saveMut.mutate({ id: editingId ?? undefined, data: formData });
  };

  const handleClone = (route: any) => {
    saveMut.mutate({
      data: {
        destination: route.destination,
        gateway: route.gateway,
        interface: route.interface,
        distance: route.distance,
        priority: route.priority,
        status: route.status,
        comment: `${route.comment} (Copy)`,
      },
    });
    toast.success('Route cloned');
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) { toast.error('Select routes to delete'); return; }
    selectedIds.forEach(id => deleteMut.mutate(id));
    setSelectedIds([]);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(routes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'static_routes.json';
    a.click();
    toast.success('Routes exported');
  };

  const filteredRoutes = (routes as any[]).filter(r =>
    (r.destination ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.gateway ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.interface ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.comment ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.length === filteredRoutes.length ? [] : filteredRoutes.map(r => r.id));
  };

  return (
    <Shell>
      <div className="space-y-0 animate-slide-in">
        <div className="forti-toolbar">
          <button className="forti-toolbar-btn primary" onClick={handleCreate}>
            <Plus className="w-3 h-3" />
            Create New
          </button>
          <button
            className="forti-toolbar-btn"
            disabled={selectedIds.length !== 1}
            onClick={() => {
              const r = (routes as any[]).find((r: any) => r.id === selectedIds[0]);
              if (r) handleEdit(r);
            }}
          >
            <Edit2 className="w-3 h-3" />
            Edit
          </button>
          <button
            className="forti-toolbar-btn"
            disabled={selectedIds.length !== 1}
            onClick={() => {
              const r = (routes as any[]).find((r: any) => r.id === selectedIds[0]);
              if (r) handleClone(r);
            }}
          >
            <Copy className="w-3 h-3" />
            Clone
          </button>
          <button
            className="forti-toolbar-btn"
            disabled={selectedIds.length === 0}
            onClick={handleBulkDelete}
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={handleExport}>
            <Download className="w-3 h-3" />
            Export
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={() => queryClient.invalidateQueries({ queryKey: ['static-routes'] })}>
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
          <div className="flex-1" />
          <div className="forti-search">
            <Search className="w-3 h-3 text-[#999]" />
            <input
              type="text"
              placeholder="Search routes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48"
            />
          </div>
        </div>

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
              <th className="w-16">Status</th>
              <th>Destination</th>
              <th>Gateway</th>
              <th>Interface</th>
              <th>Distance</th>
              <th>Priority</th>
              <th>Comment</th>
              <th className="w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={9} className="text-center py-8 text-[#999] text-[11px]">Loading…</td></tr>
            )}
            {!isLoading && filteredRoutes.length === 0 && (
              <tr><td colSpan={9} className="text-center py-8 text-[#999] text-[11px]">No static routes configured</td></tr>
            )}
            {filteredRoutes.map((route: any) => (
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
                    onChange={() => setSelectedIds(prev =>
                      prev.includes(route.id) ? prev.filter(i => i !== route.id) : [...prev, route.id]
                    )}
                  />
                </td>
                <td>
                  <FortiToggle
                    enabled={route.status === 'enabled'}
                    onToggle={() => toggleMut.mutate({ id: route.id, status: route.status === 'enabled' ? 'disabled' : 'enabled' })}
                    size="sm"
                  />
                </td>
                <td className="font-mono text-[#111] font-medium">{route.destination}</td>
                <td className="font-mono text-[#111]">
                  <span className="flex items-center gap-1">
                    <ArrowRight className="w-3 h-3 text-[#666]" />
                    {route.gateway}
                  </span>
                </td>
                <td>
                  <span className="forti-tag bg-blue-100 text-blue-700 border-blue-200">
                    {route.interface}
                  </span>
                </td>
                <td className="text-[#333]">{route.distance}</td>
                <td className="text-[#333]">{route.priority}</td>
                <td className="text-[#333]">{route.comment}</td>
                <td>
                  <div className="flex items-center gap-1">
                    <button className="p-1 hover:bg-[#f0f0f0]" onClick={() => handleEdit(route)} title="Edit">
                      <Edit2 className="w-3 h-3 text-[#666]" />
                    </button>
                    <button className="p-1 hover:bg-[#f0f0f0]" onClick={() => { setRouteToDelete(route.id); setDeleteConfirmOpen(true); }} title="Delete">
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center justify-between px-3 py-2 bg-[#f5f5f5] border border-t-0 border-[#ddd] text-[11px] text-[#333]">
          <span>Total: {(routes as any[]).length} routes</span>
          <span>Showing {filteredRoutes.length} of {(routes as any[]).length}</span>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white border border-[#ccc] shadow-xl w-[500px]">
            <div className="forti-modal-header flex items-center justify-between">
              <span>{editingId ? 'Edit Static Route' : 'Create Static Route'}</span>
              <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="forti-modal-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="forti-label">Destination *</label>
                  <input
                    type="text"
                    className="forti-input w-full"
                    placeholder="0.0.0.0/0"
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  />
                </div>
                <div>
                  <label className="forti-label">Gateway *</label>
                  <input
                    type="text"
                    className="forti-input w-full"
                    placeholder="192.168.1.1"
                    value={formData.gateway}
                    onChange={(e) => setFormData({ ...formData, gateway: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="forti-label">Interface</label>
                  <select
                    className="forti-select w-full"
                    value={formData.interface}
                    onChange={(e) => setFormData({ ...formData, interface: e.target.value })}
                  >
                    {ifaceNames.map(iface => (
                      <option key={iface} value={iface}>{iface}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="forti-label">Status</label>
                  <select
                    className="forti-select w-full"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'enabled' | 'disabled' })}
                  >
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="forti-label">Administrative Distance</label>
                  <input
                    type="number"
                    className="forti-input w-full"
                    value={formData.distance}
                    onChange={(e) => setFormData({ ...formData, distance: parseInt(e.target.value) || 10 })}
                  />
                </div>
                <div>
                  <label className="forti-label">Priority</label>
                  <input
                    type="number"
                    className="forti-input w-full"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div>
                <label className="forti-label">Comment</label>
                <input
                  type="text"
                  className="forti-input w-full"
                  placeholder="Description"
                  value={formData.comment}
                  onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                />
              </div>
            </div>
            <div className="forti-modal-footer">
              <button className="forti-toolbar-btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="forti-toolbar-btn primary" onClick={handleSave} disabled={saveMut.isPending}>
                {saveMut.isPending ? 'Saving…' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Route</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this static route? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => routeToDelete && deleteMut.mutate(routeToDelete)} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
};

export default StaticRoutes;
