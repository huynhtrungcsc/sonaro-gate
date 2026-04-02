import { useState } from 'react';
import { useTrafficShapers } from '@/hooks/useDbData';
import { trafficShapersApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { FortiToggle } from '@/components/ui/forti-toggle';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  RefreshCw,
  Search,
  ChevronDown,
  Gauge,
  X,
  Download,
  Upload,
  GripVertical
} from 'lucide-react';
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
import { toast } from 'sonner';
import { exportToJSON, exportToCSV, importFromJSON, createFileInput } from '@/lib/exportImport';
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
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TrafficShaper {
  id: string;
  name: string;
  type: 'shared' | 'per-ip';
  guaranteedBandwidth: number;
  maximumBandwidth: number;
  burstBandwidth: number;
  priority: 'high' | 'medium' | 'low';
  perPolicy: boolean;
  diffservForward: boolean;
  enabled: boolean;
  currentUsage: number;
}

interface SortableShaperRowProps {
  shaper: TrafficShaper;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onDoubleClick: () => void;
  formatBandwidth: (kbps: number) => string;
}

const SortableShaperRow = ({ shaper, isSelected, onSelect, onToggle, onDoubleClick, formatBandwidth }: SortableShaperRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: shaper.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr 
      ref={setNodeRef}
      style={style}
      className={cn(!shaper.enabled && "opacity-60", isSelected && "selected")}
      onDoubleClick={onDoubleClick}
    >
      <td className="w-6 cursor-grab" {...attributes} {...listeners}>
        <GripVertical className="w-3 h-3 text-[#999]" />
      </td>
      <td>
        <input 
          type="checkbox" 
          className="forti-checkbox"
          checked={isSelected}
          onChange={() => onSelect(shaper.id)}
        />
      </td>
      <td>
        <FortiToggle 
          enabled={shaper.enabled} 
          onToggle={() => onToggle(shaper.id)}
          size="sm"
        />
      </td>
      <td>
        <div className="flex items-center gap-2">
          <Gauge className="w-3 h-3 text-orange-600" />
          <span className="text-[11px] font-medium">{shaper.name}</span>
        </div>
      </td>
      <td>
        <span className={cn(
          "forti-tag",
          shaper.type === 'shared' && "bg-blue-100 text-blue-700 border-blue-200",
          shaper.type === 'per-ip' && "bg-purple-100 text-purple-700 border-purple-200"
        )}>
          {shaper.type === 'shared' ? 'Shared' : 'Per-IP'}
        </span>
      </td>
      <td className="mono text-[11px]">{formatBandwidth((shaper as any).guaranteed_bandwidth ?? (shaper as any).guaranteedBandwidth ?? 0)}</td>
      <td className="mono text-[11px]">{formatBandwidth((shaper as any).maximum_bandwidth ?? (shaper as any).maximumBandwidth ?? 0)}</td>
      <td className="mono text-[11px]">{formatBandwidth((shaper as any).burst_bandwidth ?? (shaper as any).burstBandwidth ?? 0)}</td>
      <td>
        <span className={cn(
          "forti-tag inline-block min-w-[80px] text-center",
          shaper.priority === 'high' && "bg-red-100 text-red-700 border-red-200",
          shaper.priority === 'medium' && "bg-yellow-100 text-yellow-700 border-yellow-200",
          shaper.priority === 'low' && "bg-blue-100 text-blue-700 border-blue-200"
        )}>
          {shaper.priority.charAt(0).toUpperCase() + shaper.priority.slice(1)}
        </span>
      </td>
      <td>
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-[#e0e0e0] rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full",
                ((shaper as any).current_usage ?? 0) / Math.max((shaper as any).maximum_bandwidth ?? 1, 1) > 0.8 ? "bg-red-500" :
                ((shaper as any).current_usage ?? 0) / Math.max((shaper as any).maximum_bandwidth ?? 1, 1) > 0.5 ? "bg-yellow-500" : "bg-green-500"
              )}
              style={{ width: `${Math.min(((shaper as any).current_usage ?? 0) / Math.max((shaper as any).maximum_bandwidth ?? 1, 1) * 100, 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-[#666]">{formatBandwidth((shaper as any).current_usage ?? 0)}</span>
        </div>
      </td>
    </tr>
  );
};

const TrafficShapers = () => {
  const queryClient = useQueryClient();
  const { data: shapers = [] } = useTrafficShapers();
  const createMut = useMutation({ mutationFn: (d: any) => trafficShapersApi.create(d), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['traffic-shapers'] }); setModalOpen(false); toast.success('Traffic shaper created'); }, onError: () => toast.error('Failed to create traffic shaper') });
  const updateMut = useMutation({ mutationFn: ({ id, d }: { id: string; d: any }) => trafficShapersApi.update(id, d), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['traffic-shapers'] }); setModalOpen(false); toast.success('Traffic shaper updated'); }, onError: () => toast.error('Failed to update traffic shaper') });
  const deleteMut = useMutation({ mutationFn: (id: string) => trafficShapersApi.delete(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['traffic-shapers'] }), onError: () => toast.error('Failed to delete traffic shaper') });
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TrafficShaper | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<TrafficShaper['type']>('shared');
  const [formGuaranteed, setFormGuaranteed] = useState(100);
  const [formMaximum, setFormMaximum] = useState(500);
  const [formBurst, setFormBurst] = useState(600);
  const [formPriority, setFormPriority] = useState<TrafficShaper['priority']>('medium');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const toggleShaper = (id: string) => {
    const shaper = (shapers as any[]).find((s: any) => s.id === id);
    if (shaper) updateMut.mutate({ id, d: { enabled: !shaper.enabled } });
  };

  const handleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredShapers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredShapers.map(s => s.id));
    }
  };

  const filteredShapers = shapers.filter(shaper => 
    searchQuery === '' ||
    shaper.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatBandwidth = (kbps: number) => {
    if (kbps >= 1000) {
      return `${(kbps / 1000).toFixed(0)} Mbps`;
    }
    return `${kbps} Kbps`;
  };

  const openCreateModal = (type: TrafficShaper['type']) => {
    setEditingItem(null);
    setFormName('');
    setFormType(type);
    setFormGuaranteed(100);
    setFormMaximum(500);
    setFormBurst(600);
    setFormPriority('medium');
    setModalOpen(true);
    setShowCreateMenu(false);
  };

  const openEditModal = () => {
    if (selectedIds.length !== 1) return;
    const item = (shapers as any[]).find((s: any) => s.id === selectedIds[0]);
    if (item) {
      setEditingItem(item);
      setFormName(item.name);
      setFormType(item.type);
      setFormGuaranteed(item.guaranteed_bandwidth ?? item.guaranteedBandwidth ?? 0);
      setFormMaximum(item.maximum_bandwidth ?? item.maximumBandwidth ?? 0);
      setFormBurst(item.burst_bandwidth ?? item.burstBandwidth ?? 0);
      setFormPriority(item.priority);
      setModalOpen(true);
    }
  };

  const handleSave = () => {
    if (!formName.trim()) {
      toast.error('Name is required');
      return;
    }

    const dbData = { name: formName, type: formType, guaranteed_bandwidth: formGuaranteed, maximum_bandwidth: formMaximum, burst_bandwidth: formBurst, priority: formPriority };
    if (editingItem) {
      updateMut.mutate({ id: editingItem.id, d: dbData });
    } else {
      createMut.mutate({ ...dbData, per_policy: true, diffserv_forward: false, enabled: true, current_usage: 0 });
    }
    setSelectedIds([]);
  };

  const handleDeleteConfirm = () => {
    selectedIds.forEach(id => deleteMut.mutate(id));
    toast.success(`Deleted ${selectedIds.length} shaper(s) successfully`);
    setSelectedIds([]);
    setDeleteDialogOpen(false);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['traffic-shapers'] });
    setSelectedIds([]);
    setSearchQuery('');
    toast.success('Data refreshed');
  };

  const handleExportJSON = () => {
    exportToJSON(shapers, 'traffic-shapers-config.json');
    toast.success(`Exported ${shapers.length} traffic shapers to JSON`);
  };

  const handleExportCSV = () => {
    const csvData = shapers.map(s => ({
      name: s.name,
      type: s.type,
      guaranteed: (s as any).guaranteed_bandwidth ?? (s as any).guaranteedBandwidth ?? 0,
      maximum: (s as any).maximum_bandwidth ?? (s as any).maximumBandwidth ?? 0,
      burst: (s as any).burst_bandwidth ?? (s as any).burstBandwidth ?? 0,
      priority: s.priority,
      enabled: s.enabled,
    }));
    exportToCSV(csvData, 'traffic-shapers-config.csv');
    toast.success(`Exported ${shapers.length} traffic shapers to CSV`);
  };

  const handleImport = () => {
    createFileInput('.json', (file) => {
      importFromJSON<TrafficShaper>(
        file,
        (data) => {
          const newShapers = data.map(s => ({
            ...s,
            id: `shaper-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            currentUsage: 0,
          }));
          newShapers.forEach((s: any) => createMut.mutate({ ...s, current_usage: 0 }));
          toast.success(`Imported ${newShapers.length} traffic shapers`);
        },
        (error) => toast.error(error)
      );
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      toast.success('Order updated (UI only)');
    }
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
                  onClick={() => openCreateModal('shared')}
                >
                  <Gauge className="w-3 h-3" />
                  Shared Shaper
                </button>
                <button 
                  className="w-full px-3 py-2 text-left text-[11px] hover:bg-[#f0f0f0] flex items-center gap-2"
                  onClick={() => openCreateModal('per-ip')}
                >
                  <Gauge className="w-3 h-3" />
                  Per-IP Shaper
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
            onClick={() => setDeleteDialogOpen(true)}
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="forti-toolbar-btn">
                <Download className="w-3 h-3" />
                Export
                <ChevronDown className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white border shadow-lg z-50">
              <DropdownMenuItem onClick={handleExportJSON} className="cursor-pointer text-[11px]">
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV} className="cursor-pointer text-[11px]">
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button className="forti-toolbar-btn" onClick={handleImport}>
            <Upload className="w-3 h-3" />
            Import
          </button>
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-6"></th>
                  <th className="w-8">
                    <input 
                      type="checkbox" 
                      className="forti-checkbox"
                      checked={selectedIds.length === filteredShapers.length && filteredShapers.length > 0}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="w-16">Status</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Guaranteed</th>
                  <th>Maximum</th>
                  <th>Burst</th>
                  <th>Priority</th>
                  <th>Current Usage</th>
                </tr>
              </thead>
              <SortableContext items={filteredShapers.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {filteredShapers.map((shaper) => (
                    <SortableShaperRow
                      key={shaper.id}
                      shaper={shaper}
                      isSelected={selectedIds.includes(shaper.id)}
                      onSelect={handleSelect}
                      onToggle={toggleShaper}
                      onDoubleClick={() => {
                        setSelectedIds([shaper.id]);
                        setTimeout(openEditModal, 0);
                      }}
                      formatBandwidth={formatBandwidth}
                    />
                  ))}
                  {filteredShapers.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center text-[11px] text-[#999] py-8">
                        {searchQuery ? 'No matching shapers found' : 'No traffic shapers configured'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
          <div className="text-[11px] text-[#666] mt-2 px-1">
            {filteredShapers.length} traffic shapers
            {selectedIds.length > 0 && ` (${selectedIds.length} selected)`}
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              {editingItem ? 'Edit Traffic Shaper' : 'New Traffic Shaper'}
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
                placeholder="e.g., my-shaper"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-xs text-right text-muted-foreground">Type</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as TrafficShaper['type'])}
                className="col-span-3 text-xs border border-border rounded px-2 py-1.5 bg-background"
              >
                <option value="shared">Shared</option>
                <option value="per-ip">Per-IP</option>
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-xs text-right text-muted-foreground">Guaranteed (Kbps)</label>
              <input
                type="number"
                value={formGuaranteed}
                onChange={(e) => setFormGuaranteed(parseInt(e.target.value) || 0)}
                className="col-span-3 text-xs border border-border rounded px-2 py-1.5 bg-background"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-xs text-right text-muted-foreground">Maximum (Kbps)</label>
              <input
                type="number"
                value={formMaximum}
                onChange={(e) => setFormMaximum(parseInt(e.target.value) || 0)}
                className="col-span-3 text-xs border border-border rounded px-2 py-1.5 bg-background"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-xs text-right text-muted-foreground">Burst (Kbps)</label>
              <input
                type="number"
                value={formBurst}
                onChange={(e) => setFormBurst(parseInt(e.target.value) || 0)}
                className="col-span-3 text-xs border border-border rounded px-2 py-1.5 bg-background"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-xs text-right text-muted-foreground">Priority</label>
              <select
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value as TrafficShaper['priority'])}
                className="col-span-3 text-xs border border-border rounded px-2 py-1.5 bg-background"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Traffic Shaper(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.length} traffic shaper(s)? This action cannot be undone.
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

export default TrafficShapers;
