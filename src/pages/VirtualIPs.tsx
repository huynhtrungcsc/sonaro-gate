import { useState } from 'react';
import { useVirtualIPs } from '@/hooks/useDbData';
import { virtualIpsApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { FortiToggle } from '@/components/ui/forti-toggle';
import { 
  Plus, Edit2, Trash2, RefreshCw, Search, ChevronDown, Globe, ArrowRightLeft, Server, X, Download, Upload, GripVertical
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

interface VirtualIP {
  id: string;
  name: string;
  comments: string;
  type: 'static-nat' | 'load-balance' | 'server-load-balance' | 'access-proxy';
  external_ip: string;
  mapped_ip: string;
  interface: string;
  protocol: string;
  external_port: string;
  mapped_port: string;
  enabled: boolean;
  sessions: number;
}

const initialVIPs: VirtualIP[] = [
  { id: '1', name: 'WebServer-VIP', comments: 'Main web server virtual IP', type: 'static-nat', external_ip: '203.0.113.10', mapped_ip: '192.168.1.100', interface: 'wan1', protocol: 'TCP', external_port: '443', mapped_port: '443', enabled: true, sessions: 1247 },
  { id: '2', name: 'MailServer-VIP', comments: 'Email server SMTP and IMAP', type: 'static-nat', external_ip: '203.0.113.11', mapped_ip: '192.168.1.101', interface: 'wan1', protocol: 'TCP', external_port: '25,143,993', mapped_port: '25,143,993', enabled: true, sessions: 89 },
  { id: '3', name: 'FTP-VIP', comments: 'FTP server access', type: 'static-nat', external_ip: '203.0.113.12', mapped_ip: '192.168.1.102', interface: 'wan1', protocol: 'TCP', external_port: '21', mapped_port: '21', enabled: false, sessions: 0 },
  { id: '4', name: 'LoadBalancer-VIP', comments: 'Load balanced web servers', type: 'load-balance', external_ip: '203.0.113.20', mapped_ip: '192.168.1.110-115', interface: 'wan1', protocol: 'TCP', external_port: '80,443', mapped_port: '80,443', enabled: true, sessions: 3521 },
];

interface SortableVIPRowProps {
  vip: VirtualIP;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onDoubleClick: () => void;
  getTypeLabel: (type: VirtualIP['type']) => string;
}

const SortableVIPRow = ({ vip, isSelected, onSelect, onToggle, onDoubleClick, getTypeLabel }: SortableVIPRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: vip.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr 
      ref={setNodeRef}
      style={style}
      className={cn(!vip.enabled && "opacity-60", isSelected && "selected")}
      onDoubleClick={onDoubleClick}
    >
      <td className="w-6 cursor-grab" {...attributes} {...listeners}>
        <GripVertical className="w-3 h-3 text-[#999]" />
      </td>
      <td>
        <input type="checkbox" className="forti-checkbox" checked={isSelected} onChange={() => onSelect(vip.id)} />
      </td>
      <td>
        <FortiToggle enabled={vip.enabled} onToggle={() => onToggle(vip.id)} size="sm" />
      </td>
      <td>
        <div className="flex items-center gap-2">
          <Globe className="w-3 h-3 text-blue-600" />
          <div>
            <div className="text-[11px] font-medium">{vip.name}</div>
            <div className="text-[10px] text-[#999]">{vip.comments}</div>
          </div>
        </div>
      </td>
      <td>
        <span className={cn(
          "forti-tag",
          vip.type === 'static-nat' && "bg-blue-100 text-blue-700 border-blue-200",
          vip.type === 'load-balance' && "bg-purple-100 text-purple-700 border-purple-200",
          vip.type === 'server-load-balance' && "bg-green-100 text-green-700 border-green-200",
          vip.type === 'access-proxy' && "bg-orange-100 text-orange-700 border-orange-200"
        )}>
          {getTypeLabel(vip.type)}
        </span>
      </td>
      <td className="mono text-[11px]">{vip.external_ip}</td>
      <td className="mono text-[11px]">{vip.mapped_ip}</td>
      <td>
        <span className="forti-tag bg-blue-100 text-blue-700 border-blue-200">{vip.interface}</span>
      </td>
      <td className="mono text-[11px]">{vip.protocol}:{vip.external_port}</td>
      <td className="text-right text-[11px] text-[#666]">{vip.sessions.toLocaleString()}</td>
    </tr>
  );
};

const VirtualIPs = () => {
  const queryClient = useQueryClient();
  const { data: vips = [], isLoading } = useVirtualIPs();
  const createMut = useMutation({ mutationFn: (d: any) => virtualIpsApi.create(d), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['virtual-ips'] }); setModalOpen(false); toast.success('Virtual IP created'); }, onError: () => toast.error('Failed to create VIP') });
  const updateMut = useMutation({ mutationFn: ({ id, d }: { id: string; d: any }) => virtualIpsApi.update(id, d), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['virtual-ips'] }); setModalOpen(false); toast.success('Virtual IP updated'); }, onError: () => toast.error('Failed to update VIP') });
  const deleteMut = useMutation({ mutationFn: (id: string) => virtualIpsApi.delete(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['virtual-ips'] }), onError: () => toast.error('Failed to delete VIP') });
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VirtualIP | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<VirtualIP['type']>('static-nat');
  const [formExternalIP, setFormExternalIP] = useState('');
  const [formMappedIP, setFormMappedIP] = useState('');
  const [formInterface, setFormInterface] = useState('wan1');
  const [formPort, setFormPort] = useState('');
  const [formComments, setFormComments] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const toggleVIP = (id: string) => { const vip = (vips as any[]).find((v: any) => v.id === id); if (vip) updateMut.mutate({ id, d: { enabled: !vip.enabled } }); };
  const handleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const handleSelectAll = () => setSelectedIds(selectedIds.length === filteredVIPs.length ? [] : filteredVIPs.map(v => v.id));
  const filteredVIPs = vips.filter(vip => searchQuery === '' || vip.name.toLowerCase().includes(searchQuery.toLowerCase()) || vip.external_ip.includes(searchQuery));
  const getTypeLabel = (type: VirtualIP['type']) => ({ 'static-nat': 'Static NAT', 'load-balance': 'Load Balance', 'server-load-balance': 'Server LB', 'access-proxy': 'Access Proxy' }[type]);

  const openCreateModal = (type: VirtualIP['type']) => { 
    setEditingItem(null); 
    setFormName(''); 
    setFormType(type); 
    setFormExternalIP(''); 
    setFormMappedIP(''); 
    setFormInterface('wan1'); 
    setFormPort(''); 
    setFormComments(''); 
    setModalOpen(true); 
    setShowCreateMenu(false); 
  };

  const openEditModal = () => { 
    if (selectedIds.length !== 1) return; 
    const item = vips.find(v => v.id === selectedIds[0]); 
    if (item) { 
      setEditingItem(item); 
      setFormName(item.name); 
      setFormType(item.type); 
      setFormExternalIP(item.external_ip); 
      setFormMappedIP(item.mapped_ip); 
      setFormInterface(item.interface); 
      setFormPort(item.external_port); 
      setFormComments(item.comments); 
      setModalOpen(true); 
    } 
  };

  const handleSave = () => { 
    if (!formName.trim() || !formExternalIP.trim() || !formMappedIP.trim()) { 
      toast.error('Name, External IP, and Mapped IP are required'); 
      return; 
    } 
    const dbData = { name: formName, type: formType, external_ip: formExternalIP, mapped_ip: formMappedIP, interface: formInterface, protocol: 'TCP', external_port: formPort, mapped_port: formPort, comments: formComments };
    if (editingItem) { 
      updateMut.mutate({ id: editingItem.id, d: dbData });
    } else { 
      createMut.mutate({ ...dbData, enabled: true, sessions: 0 });
    } 
    setSelectedIds([]); 
  };

  const handleDeleteConfirm = () => { 
    selectedIds.forEach(id => deleteMut.mutate(id));
    toast.success(`Deleted ${selectedIds.length} item(s)`); 
    setSelectedIds([]); 
    setDeleteDialogOpen(false);
  };

  const handleRefresh = () => { 
    queryClient.invalidateQueries({ queryKey: ['virtual-ips'] });
    setSelectedIds([]); 
    setSearchQuery(''); 
    toast.success('Data refreshed'); 
  };

  const handleExportJSON = () => {
    exportToJSON(vips, 'virtual-ips-config.json');
    toast.success(`Exported ${vips.length} virtual IPs to JSON`);
  };

  const handleExportCSV = () => {
    const csvData = vips.map(v => ({
      name: v.name,
      type: v.type,
      external_ip: v.external_ip,
      mapped_ip: v.mapped_ip,
      interface: v.interface,
      protocol: v.protocol,
      port: v.external_port,
      enabled: v.enabled,
      sessions: v.sessions,
    }));
    exportToCSV(csvData, 'virtual-ips-config.csv');
    toast.success(`Exported ${vips.length} virtual IPs to CSV`);
  };

  const handleImport = () => {
    createFileInput('.json', (file) => {
      importFromJSON<VirtualIP>(
        file,
        (data) => {
          const newVIPs = data.map(v => ({
            ...v,
            sessions: 0,
          }));
          newVIPs.forEach(v => createMut.mutate(v));
          toast.success(`Imported ${newVIPs.length} virtual IPs`);
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
        <div className="forti-toolbar">
          <div className="relative">
            <button className="forti-toolbar-btn primary" onClick={() => setShowCreateMenu(!showCreateMenu)}>
              <Plus className="w-3 h-3" />Create New<ChevronDown className="w-3 h-3" />
            </button>
            {showCreateMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#ccc] shadow-lg z-50 min-w-[180px]">
                <button className="w-full px-3 py-2 text-left text-[11px] hover:bg-[#f0f0f0] flex items-center gap-2" onClick={() => openCreateModal('static-nat')}>
                  <Globe className="w-3 h-3" />Static NAT
                </button>
                <button className="w-full px-3 py-2 text-left text-[11px] hover:bg-[#f0f0f0] flex items-center gap-2" onClick={() => openCreateModal('load-balance')}>
                  <ArrowRightLeft className="w-3 h-3" />Load Balance
                </button>
                <button className="w-full px-3 py-2 text-left text-[11px] hover:bg-[#f0f0f0] flex items-center gap-2" onClick={() => openCreateModal('server-load-balance')}>
                  <Server className="w-3 h-3" />Server Load Balance
                </button>
              </div>
            )}
          </div>
          <button className="forti-toolbar-btn" disabled={selectedIds.length !== 1} onClick={openEditModal}>
            <Edit2 className="w-3 h-3" />Edit
          </button>
          <button className="forti-toolbar-btn" disabled={selectedIds.length === 0} onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 className="w-3 h-3" />Delete
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={handleRefresh}>
            <RefreshCw className="w-3 h-3" />Refresh
          </button>
          <div className="flex-1" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="forti-toolbar-btn">
                <Download className="w-3 h-3" />Export<ChevronDown className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white border shadow-lg z-50">
              <DropdownMenuItem onClick={handleExportJSON} className="cursor-pointer text-[11px]">Export as JSON</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV} className="cursor-pointer text-[11px]">Export as CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button className="forti-toolbar-btn" onClick={handleImport}>
            <Upload className="w-3 h-3" />Import
          </button>
          <div className="forti-search">
            <Search className="w-3 h-3 text-[#999]" />
            <input type="text" placeholder="Search..." className="w-40" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            {searchQuery && <button onClick={() => setSearchQuery('')}><X className="w-3 h-3 text-[#999]" /></button>}
          </div>
        </div>
        <div className="p-4">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-6"></th>
                  <th className="w-8">
                    <input type="checkbox" className="forti-checkbox" checked={selectedIds.length === filteredVIPs.length && filteredVIPs.length > 0} onChange={handleSelectAll} />
                  </th>
                  <th className="w-16">Status</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>External IP</th>
                  <th>Mapped IP</th>
                  <th>Interface</th>
                  <th>Protocol/Port</th>
                  <th className="text-right">Sessions</th>
                </tr>
              </thead>
              <SortableContext items={filteredVIPs.map(v => v.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {filteredVIPs.map((vip) => (
                    <SortableVIPRow
                      key={vip.id}
                      vip={vip}
                      isSelected={selectedIds.includes(vip.id)}
                      onSelect={handleSelect}
                      onToggle={toggleVIP}
                      onDoubleClick={() => {
                        setSelectedIds([vip.id]);
                        setTimeout(openEditModal, 0);
                      }}
                      getTypeLabel={getTypeLabel}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
          <div className="text-[11px] text-[#666] mt-2 px-1">
            {filteredVIPs.length} virtual IPs{selectedIds.length > 0 && ` (${selectedIds.length} selected)`}
          </div>
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">{editingItem ? 'Edit Virtual IP' : 'New Virtual IP'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-xs text-right">Name</label>
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="col-span-3 text-xs border rounded px-2 py-1.5" />
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-xs text-right">Type</label>
              <select value={formType} onChange={(e) => setFormType(e.target.value as VirtualIP['type'])} className="col-span-3 text-xs border rounded px-2 py-1.5">
                <option value="static-nat">Static NAT</option>
                <option value="load-balance">Load Balance</option>
                <option value="server-load-balance">Server Load Balance</option>
                <option value="access-proxy">Access Proxy</option>
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-xs text-right">External IP</label>
              <input type="text" value={formExternalIP} onChange={(e) => setFormExternalIP(e.target.value)} className="col-span-3 text-xs border rounded px-2 py-1.5 font-mono" />
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-xs text-right">Mapped IP</label>
              <input type="text" value={formMappedIP} onChange={(e) => setFormMappedIP(e.target.value)} className="col-span-3 text-xs border rounded px-2 py-1.5 font-mono" />
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-xs text-right">Interface</label>
              <select value={formInterface} onChange={(e) => setFormInterface(e.target.value)} className="col-span-3 text-xs border rounded px-2 py-1.5">
                <option value="wan1">wan1</option>
                <option value="wan2">wan2</option>
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-xs text-right">Port</label>
              <input type="text" value={formPort} onChange={(e) => setFormPort(e.target.value)} className="col-span-3 text-xs border rounded px-2 py-1.5 font-mono" placeholder="e.g., 443" />
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <label className="text-xs text-right">Comments</label>
              <input type="text" value={formComments} onChange={(e) => setFormComments(e.target.value)} className="col-span-3 text-xs border rounded px-2 py-1.5" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button onClick={() => setModalOpen(false)} className="px-3 py-1.5 text-xs border rounded hover:bg-muted">Cancel</button>
            <button onClick={handleSave} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded">{editingItem ? 'Save' : 'Create'}</button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Virtual IP(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.length} virtual IP(s)? This action cannot be undone.
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

export default VirtualIPs;
