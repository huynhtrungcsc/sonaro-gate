import { useState } from 'react';
import { useServices } from '@/hooks/useDbData';
import { servicesApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  RefreshCw,
  Search,
  ChevronDown,
  Server,
  Hash,
  Network,
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ServiceObject {
  id: string;
  name: string;
  category: string;
  protocol: 'TCP' | 'UDP' | 'TCP/UDP' | 'ICMP' | 'IP';
  dest_ports: string;
  source_ports: string;
  comment: string;
  references: number;
  references_count: number;
  is_system: boolean;
}

// Sortable Service Row
interface SortableServiceRowProps {
  service: ServiceObject;
  selectedIds: string[];
  handleSelect: (id: string) => void;
  getProtocolColor: (protocol: string) => string;
  onDoubleClick: () => void;
}

const SortableServiceRow = ({ service, selectedIds, handleSelect, getProtocolColor, onDoubleClick }: SortableServiceRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: service.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr 
      ref={setNodeRef}
      style={style}
      className={cn(selectedIds.includes(service.id) && "selected", isDragging && "bg-blue-50")}
      onDoubleClick={onDoubleClick}
    >
      <td>
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-[#f0f0f0]">
          <GripVertical className="w-3 h-3 text-[#999]" />
        </button>
      </td>
      <td>
        <input 
          type="checkbox" 
          className="forti-checkbox"
          checked={selectedIds.includes(service.id)}
          onChange={() => handleSelect(service.id)}
        />
      </td>
      <td>
        <div className="flex items-center gap-2">
          <Hash className="w-3 h-3 text-amber-600" />
          <span className="text-[11px] font-medium">{service.name}</span>
          {service.is_system && (
            <span className="text-[9px] px-1 py-0.5 bg-gray-100 text-gray-500 border border-gray-200 rounded">
              SYSTEM
            </span>
          )}
        </div>
      </td>
      <td className="text-[11px] text-[#666]">{service.category}</td>
      <td>
        <span className={cn("forti-tag", getProtocolColor(service.protocol))}>
          {service.protocol}
        </span>
      </td>
      <td className="mono text-[11px]">{service.dest_ports}</td>
      <td className="text-[11px] text-[#666]">{service.comment}</td>
      <td className="text-center">
        <span className={cn(
          "text-[11px]",
          service.references_count > 0 ? "text-blue-600" : "text-[#999]"
        )}>
          {service.references_count}
        </span>
      </td>
    </tr>
  );
};

const Services = () => {
  const queryClient = useQueryClient();
  const { data: services = [], isLoading } = useServices();
  const createMut = useMutation({ mutationFn: (d: any) => servicesApi.create(d), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] }), onError: () => toast.error('Failed to create service') });
  const updateMut = useMutation({ mutationFn: ({ id, d }: { id: string; d: any }) => servicesApi.update(id, d), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] }), onError: () => toast.error('Failed to update service') });
  const deleteMut = useMutation({ mutationFn: (id: string) => servicesApi.delete(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] }), onError: () => toast.error('Failed to delete service') });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ServiceObject | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Form state
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Custom');
  const [formProtocol, setFormProtocol] = useState<ServiceObject['protocol']>('TCP');
  const [formDestPorts, setFormDestPorts] = useState('');
  const [formComment, setFormComment] = useState('');

  const handleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredServices.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredServices.map(s => s.id));
    }
  };

  const categories = ['all', ...Array.from(new Set(services.map(s => s.category)))];

  const filteredServices = services.filter(service => {
    const matchesSearch = searchQuery === '' ||
      service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.comment.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || service.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const getProtocolColor = (protocol: string) => {
    switch (protocol) {
      case 'TCP': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'UDP': return 'bg-green-100 text-green-700 border-green-200';
      case 'TCP/UDP': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'ICMP': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const openCreateModal = (type: 'service' | 'group') => {
    setEditingItem(null);
    setFormName('');
    setFormCategory('Custom');
    setFormProtocol('TCP');
    setFormDestPorts('');
    setFormComment('');
    setModalOpen(true);
    setShowCreateMenu(false);
  };

  const openEditModal = () => {
    if (selectedIds.length !== 1) return;
    const item = services.find(s => s.id === selectedIds[0]);
    if (item) {
      if (item.is_system) {
        toast.error('System services cannot be edited');
        return;
      }
      setEditingItem(item);
      setFormName(item.name);
      setFormCategory(item.category);
      setFormProtocol(item.protocol);
      setFormDestPorts(item.dest_ports);
      setFormComment(item.comment);
      setModalOpen(true);
    }
  };

  const handleSave = () => {
    if (!formName.trim() || !formDestPorts.trim()) {
      toast.error('Name and Destination Port are required');
      return;
    }

    const dbData = { name: formName, category: formCategory, protocol: formProtocol, dest_ports: formDestPorts, source_ports: '1-65535', comment: formComment };
    if (editingItem) {
      updateMut.mutate({ id: editingItem.id, d: dbData });
      toast.success(`Updated "${formName}" successfully`);
    } else {
      createMut.mutate(dbData);
      toast.success(`Created "${formName}" successfully`);
    }
    setModalOpen(false);
    setSelectedIds([]);
  };

  const handleDeleteConfirm = () => {
    const hasSystem = services.some(s => selectedIds.includes(s.id) && s.is_system);
    if (hasSystem) {
      toast.error('System services cannot be deleted');
      setDeleteDialogOpen(false);
      return;
    }

    const hasReferences = services.some(s => selectedIds.includes(s.id) && s.references_count > 0);
    if (hasReferences) {
      toast.error('Cannot delete services that are referenced by policies');
      setDeleteDialogOpen(false);
      return;
    }

    selectedIds.forEach(id => deleteMut.mutate(id));
    toast.success(`Deleted ${selectedIds.length} item(s) successfully`);
    setSelectedIds([]);
    setDeleteDialogOpen(false);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['services'] });
    setSelectedIds([]);
    setSearchQuery('');
    setActiveCategory('all');
    toast.success('Data refreshed');
  };

  const handleExportJSON = () => {
    exportToJSON(services, 'services-config.json');
    toast.success(`Exported ${services.length} services to JSON`);
  };

  const handleExportCSV = () => {
    const csvData = services.map(s => ({
      name: s.name,
      category: s.category,
      protocol: s.protocol,
      dest_ports: s.dest_ports,
      source_ports: s.source_ports,
      comment: s.comment,
      references: s.references_count,
      is_system: s.is_system,
    }));
    exportToCSV(csvData, 'services-config.csv');
    toast.success(`Exported ${services.length} services to CSV`);
  };

  const handleImport = () => {
    createFileInput('.json', (file) => {
      importFromJSON<ServiceObject>(
        file,
        (data) => {
          const newServices = data.map((s: any) => ({ name: s.name, category: s.category || 'Custom', protocol: s.protocol || 'TCP', dest_ports: s.destPorts || s.dest_ports || '', source_ports: '1-65535', comment: s.comment || '' }));
          newServices.forEach(s => createMut.mutate(s));
          toast.success(`Imported ${newServices.length} services`);
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
                  onClick={() => openCreateModal('service')}
                >
                  <Server className="w-3 h-3" />
                  Service
                </button>
                <button 
                  className="w-full px-3 py-2 text-left text-[11px] hover:bg-[#f0f0f0] flex items-center gap-2"
                  onClick={() => openCreateModal('group')}
                >
                  <Network className="w-3 h-3" />
                  Service Group
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

        {/* Category Tabs */}
        <div className="flex items-center bg-[#e8e8e8] border-b border-[#ccc]">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-4 py-2 text-[11px] font-medium transition-colors border-b-2",
                activeCategory === cat 
                  ? "bg-white text-[hsl(142,70%,35%)] border-[hsl(142,70%,35%)]" 
                  : "text-[#666] border-transparent hover:text-[#333] hover:bg-[#f0f0f0]"
              )}
            >
              {cat === 'all' ? 'All Services' : cat}
              <span className={cn(
                "ml-1.5 px-1.5 py-0.5 text-[10px] rounded",
                activeCategory === cat ? "bg-[hsl(142,70%,35%)]/20 text-[hsl(142,70%,35%)]" : "bg-[#ddd] text-[#666]"
              )}>
                {cat === 'all' ? services.length : services.filter(s => s.category === cat).length}
              </span>
            </button>
          ))}
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
                      checked={selectedIds.length === filteredServices.length && filteredServices.length > 0}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Protocol</th>
                  <th>Destination Port</th>
                  <th>Comments</th>
                  <th className="text-center">Ref.</th>
                </tr>
              </thead>
              <SortableContext items={filteredServices.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {filteredServices.map((service) => (
                    <SortableServiceRow
                      key={service.id}
                      service={service}
                      selectedIds={selectedIds}
                      handleSelect={handleSelect}
                      getProtocolColor={getProtocolColor}
                      onDoubleClick={() => {
                        setSelectedIds([service.id]);
                        setTimeout(openEditModal, 0);
                      }}
                    />
                  ))}
                  {filteredServices.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center text-[11px] text-[#999] py-8">
                        {searchQuery ? 'No matching services found' : 'No services configured'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
          <div className="text-[11px] text-[#666] mt-2 px-1">
            {filteredServices.length} services
            {selectedIds.length > 0 && ` (${selectedIds.length} selected)`}
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              {editingItem ? 'Edit Service' : 'New Service'}
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
                placeholder="e.g., My-Service"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-xs text-right text-muted-foreground">Category</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="col-span-3 text-xs border border-border rounded px-2 py-1.5 bg-background"
              >
                <option value="Custom">Custom</option>
                <option value="Web Access">Web Access</option>
                <option value="Remote Access">Remote Access</option>
                <option value="File Access">File Access</option>
                <option value="Email">Email</option>
                <option value="Network Services">Network Services</option>
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-xs text-right text-muted-foreground">Protocol</label>
              <select
                value={formProtocol}
                onChange={(e) => setFormProtocol(e.target.value as ServiceObject['protocol'])}
                className="col-span-3 text-xs border border-border rounded px-2 py-1.5 bg-background"
              >
                <option value="TCP">TCP</option>
                <option value="UDP">UDP</option>
                <option value="TCP/UDP">TCP/UDP</option>
                <option value="ICMP">ICMP</option>
                <option value="IP">IP</option>
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-xs text-right text-muted-foreground">Dest. Port</label>
              <input
                type="text"
                value={formDestPorts}
                onChange={(e) => setFormDestPorts(e.target.value)}
                className="col-span-3 text-xs border border-border rounded px-2 py-1.5 bg-background font-mono"
                placeholder="e.g., 8080 or 8080-8090"
              />
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.length} service(s)? This action cannot be undone.
              System services and services referenced by policies cannot be deleted.
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

export default Services;
