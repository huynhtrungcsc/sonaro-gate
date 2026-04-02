import { useState } from 'react';
import { useWildcardFQDNs } from '@/hooks/useDbData';
import { wildcardFqdnsApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { Plus, Edit2, Trash2, Search, Globe, RefreshCw, ChevronDown, ExternalLink, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface WildcardFQDNItem {
  id: string;
  name: string;
  fqdn: string;
  interface: string;
  comment: string;
  visibility: boolean;
  references: number;
}

// Data loaded from database via useWildcardFQDNs hook

const WildcardFQDN = () => {
  const queryClient = useQueryClient();
  const { data: fqdns = [] } = useWildcardFQDNs();
  const createMut = useMutation({ mutationFn: (d: any) => wildcardFqdnsApi.create(d), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wildcard-fqdns'] }); setModalOpen(false); toast.success('FQDN created'); }, onError: () => toast.error('Failed to create FQDN') });
  const updateMut = useMutation({ mutationFn: ({ id, d }: { id: string; d: any }) => wildcardFqdnsApi.update(id, d), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wildcard-fqdns'] }); setModalOpen(false); toast.success('FQDN updated'); }, onError: () => toast.error('Failed to update FQDN') });
  const deleteMut = useMutation({ mutationFn: (id: string) => wildcardFqdnsApi.delete(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wildcard-fqdns'] }), onError: () => toast.error('Failed to delete FQDN') });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WildcardFQDNItem | null>(null);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formFqdn, setFormFqdn] = useState('');
  const [formInterface, setFormInterface] = useState('any');
  const [formComment, setFormComment] = useState('');

  const handleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredFQDNs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredFQDNs.map(f => f.id));
    }
  };

  const filteredFQDNs = fqdns.filter(fqdn => 
    searchQuery === '' ||
    fqdn.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    fqdn.fqdn.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openCreateModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormFqdn('');
    setFormInterface('any');
    setFormComment('');
    setModalOpen(true);
    setShowCreateMenu(false);
  };

  const openEditModal = () => {
    if (selectedIds.length !== 1) return;
    const item = fqdns.find(f => f.id === selectedIds[0]);
    if (item) {
      setEditingItem(item);
      setFormName(item.name);
      setFormFqdn(item.fqdn);
      setFormInterface(item.interface);
      setFormComment(item.comment);
      setModalOpen(true);
    }
  };

  const handleSave = () => {
    if (!formName.trim() || !formFqdn.trim()) {
      toast.error('Name and FQDN are required');
      return;
    }

    const dbData = { name: formName, fqdn: formFqdn, interface: formInterface, comment: formComment };
    if (editingItem) {
      updateMut.mutate({ id: editingItem.id, d: dbData });
    } else {
      createMut.mutate({ ...dbData, visibility: true });
    }
    setSelectedIds([]);
  };

  const handleDelete = () => {
    if (selectedIds.length === 0) return;
    
    const hasReferences = (fqdns as any[]).some((f: any) => selectedIds.includes(f.id) && (f.references_count ?? f.references ?? 0) > 0);
    if (hasReferences) {
      toast.error('Cannot delete items that are referenced by policies');
      return;
    }

    selectedIds.forEach(id => deleteMut.mutate(id));
    toast.success(`Deleted ${selectedIds.length} item(s) successfully`);
    setSelectedIds([]);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['wildcard-fqdns'] });
    setSelectedIds([]);
    setSearchQuery('');
    toast.success('Data refreshed');
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
                  className="w-full px-3 py-2 text-left text-[11px] hover:bg-[#f0f0f0] flex items-center gap-2"
                  onClick={openCreateModal}
                >
                  <Globe className="w-3 h-3" />
                  Wildcard FQDN
                </button>
              </div>
            )}
          </div>
          <button 
            className="forti-toolbar-btn" 
            disabled={selectedIds.length !== 1}
            onClick={openEditModal}
          >
            <Edit2 className="w-3 h-3" />
            Edit
          </button>
          <button 
            className="forti-toolbar-btn" 
            disabled={selectedIds.length === 0}
            onClick={handleDelete}
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={handleRefresh}>
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
          <div className="flex-1" />
          <div className="forti-search">
            <Search className="w-3 h-3 text-[#999]" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="w-40"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-[#999] hover:text-[#666]">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="p-4">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-8">
                  <input 
                    type="checkbox" 
                    className="forti-checkbox"
                    checked={selectedIds.length === filteredFQDNs.length && filteredFQDNs.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>Name</th>
                <th>Wildcard FQDN</th>
                <th>Interface</th>
                <th>Comments</th>
                <th className="text-center">Ref.</th>
              </tr>
            </thead>
            <tbody>
              {filteredFQDNs.map((fqdn) => (
                <tr 
                  key={fqdn.id} 
                  className={cn(selectedIds.includes(fqdn.id) && "selected")}
                  onDoubleClick={() => {
                    setSelectedIds([fqdn.id]);
                    setTimeout(() => openEditModal(), 0);
                  }}
                >
                  <td>
                    <input 
                      type="checkbox" 
                      className="forti-checkbox"
                      checked={selectedIds.includes(fqdn.id)}
                      onChange={() => handleSelect(fqdn.id)}
                    />
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Globe className="w-3 h-3 text-purple-600" />
                      <span className="text-[11px] font-medium">{fqdn.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className="mono text-[11px] flex items-center gap-1">
                      <ExternalLink className="w-3 h-3 text-[#999]" />
                      {fqdn.fqdn}
                    </span>
                  </td>
                  <td>
                    <span className="forti-tag bg-blue-100 text-blue-700 border-blue-200">
                      {fqdn.interface}
                    </span>
                  </td>
                  <td className="text-[11px] text-[#666]">{fqdn.comment}</td>
                  <td className="text-center">
                    <span className={cn(
                      "text-[11px]",
                      ((fqdn as any).references_count ?? (fqdn as any).references ?? 0) > 0 ? "text-blue-600" : "text-[#999]"
                    )}>
                      {(fqdn as any).references_count ?? (fqdn as any).references ?? 0}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredFQDNs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-[11px] text-[#999] py-8">
                    {searchQuery ? 'No matching records found' : 'No wildcard FQDN addresses configured'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="text-[11px] text-[#666] mt-2 px-1">
            {filteredFQDNs.length} wildcard FQDN addresses
            {selectedIds.length > 0 && ` (${selectedIds.length} selected)`}
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              {editingItem ? 'Edit Wildcard FQDN' : 'New Wildcard FQDN'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-xs text-right text-muted-foreground">Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="col-span-3 text-xs border border-border rounded px-2 py-1.5 bg-background"
                placeholder="e.g., my-wildcard-fqdn"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-xs text-right text-muted-foreground">FQDN</label>
              <input
                type="text"
                value={formFqdn}
                onChange={(e) => setFormFqdn(e.target.value)}
                className="col-span-3 text-xs border border-border rounded px-2 py-1.5 bg-background font-mono"
                placeholder="e.g., *.example.com"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-xs text-right text-muted-foreground">Interface</label>
              <select
                value={formInterface}
                onChange={(e) => setFormInterface(e.target.value)}
                className="col-span-3 text-xs border border-border rounded px-2 py-1.5 bg-background"
              >
                <option value="any">any</option>
                <option value="wan1">wan1</option>
                <option value="wan2">wan2</option>
                <option value="internal">internal</option>
                <option value="dmz">dmz</option>
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-xs text-right text-muted-foreground">Comment</label>
              <input
                type="text"
                value={formComment}
                onChange={(e) => setFormComment(e.target.value)}
                className="col-span-3 text-xs border border-border rounded px-2 py-1.5 bg-background"
                placeholder="Optional description"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              onClick={() => setModalOpen(false)}
              className="px-3 py-1.5 text-xs border border-border rounded hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              {editingItem ? 'Save' : 'Create'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Shell>
  );
};

export default WildcardFQDN;
