import { useState, useEffect, useRef } from 'react';
import { useAliases } from '@/hooks/useDbData';
import { aliasesApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { Plus, Pencil, Trash2, Search, Network, Server, Hash, ChevronDown, Download, Upload, GripVertical } from 'lucide-react';
import { exportToJSON, exportToCSV, importFromJSON, createFileInput } from '@/lib/exportImport';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
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

interface Alias {
  id: string;
  name: string;
  type: 'host' | 'network' | 'port';
  values: string[];
  description: string;
  usageCount: number;
  created: Date;
  updated: Date;
}

// Data loaded from database via useAliases hook

const formSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(32, 'Name must be 32 characters or less')
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Name must be uppercase, start with a letter, and contain only letters, numbers, and underscores'),
  type: z.enum(['host', 'network', 'port']),
  values: z.string().min(1, 'At least one value is required'),
  description: z.string().max(200, 'Description too long'),
});

type FormValues = z.infer<typeof formSchema>;

interface SortableAliasRowProps {
  alias: Alias;
  isSelected: boolean;
  onSelect: (id: string) => void;
  getTypeIcon: (type: Alias['type']) => JSX.Element;
  getTypeColor: (type: Alias['type']) => string;
}

const SortableAliasRow = ({ alias, isSelected, onSelect, getTypeIcon, getTypeColor }: SortableAliasRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: alias.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr 
      ref={setNodeRef}
      style={style}
      className={cn(isSelected && "data-table-row-selected")}
      onClick={() => onSelect(alias.id)}
    >
      <td className="w-6 cursor-grab" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
        <GripVertical className="w-3 h-3 text-[#999]" />
      </td>
      <td onClick={(e) => e.stopPropagation()}>
        <input 
          type="checkbox" 
          checked={isSelected}
          onChange={() => onSelect(alias.id)}
          className="rounded border-gray-300"
        />
      </td>
      <td>
        <div className="flex items-center gap-2">
          <span className={cn("p-1 rounded", getTypeColor(alias.type))}>
            {getTypeIcon(alias.type)}
          </span>
          <span className="font-mono font-medium text-sm">{alias.name}</span>
        </div>
      </td>
      <td>
        <span className={cn("forti-tag", getTypeColor(alias.type))}>
          {alias.type.toUpperCase()}
        </span>
      </td>
      <td>
        <div className="flex flex-wrap gap-1">
          {alias.values.slice(0, 3).map((value, idx) => (
            <span key={idx} className="px-1.5 py-0.5 text-[11px] font-mono bg-muted rounded">
              {value}
            </span>
          ))}
          {alias.values.length > 3 && (
            <span className="px-1.5 py-0.5 text-[10px] text-muted-foreground">
              +{alias.values.length - 3} more
            </span>
          )}
        </div>
      </td>
      <td className="text-muted-foreground text-sm">{alias.description}</td>
      <td className="text-center">
        <span className={cn(
          "text-xs font-medium",
          alias.usageCount > 0 ? "text-blue-600" : "text-muted-foreground"
        )}>
          {alias.usageCount}
        </span>
      </td>
    </tr>
  );
};

const Aliases = () => {
  const { data: dbAliases } = useAliases();
  const queryClient = useQueryClient();
  const [aliases, setAliases] = useState<Alias[]>([]);

  const createMut = useMutation({
    mutationFn: (d: any) => aliasesApi.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['aliases'] }); setModalOpen(false); toast.success('Alias created'); },
    onError: () => toast.error('Failed to create alias'),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: any }) => aliasesApi.update(id, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['aliases'] }); setModalOpen(false); toast.success('Alias updated'); },
    onError: () => toast.error('Failed to update alias'),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => aliasesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['aliases'] }),
    onError: () => toast.error('Failed to delete alias'),
  });

  useEffect(() => {
    if (dbAliases) {
      setAliases(dbAliases.map((a: any) => ({
        id: a.id,
        name: a.name,
        type: a.type as 'host' | 'network' | 'port',
        values: a.values || [],
        description: a.description || '',
        usageCount: a.usage_count || 0,
        created: new Date(a.created_at),
        updated: new Date(a.updated_at),
      })));
    }
  }, [dbAliases]);
  const [filter, setFilter] = useState<'all' | 'host' | 'network' | 'port'>('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAlias, setEditingAlias] = useState<Alias | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      type: 'host',
      values: '',
      description: '',
    },
  });

  const filtered = aliases.filter(a => {
    const matchesType = filter === 'all' || a.type === filter;
    const matchesSearch = search === '' || 
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase()) ||
      a.values.some(v => v.includes(search));
    return matchesType && matchesSearch;
  });

  const typeStats = {
    all: aliases.length,
    host: aliases.filter(a => a.type === 'host').length,
    network: aliases.filter(a => a.type === 'network').length,
    port: aliases.filter(a => a.type === 'port').length,
  };

  const handleAdd = (type: 'host' | 'network' | 'port') => {
    setEditingAlias(null);
    form.reset({
      name: '',
      type: type,
      values: '',
      description: '',
    });
    setModalOpen(true);
  };

  const handleEdit = (alias: Alias) => {
    setEditingAlias(alias);
    form.reset({
      name: alias.name,
      type: alias.type,
      values: alias.values.join('\n'),
      description: alias.description,
    });
    setModalOpen(true);
  };

  const handleDeleteConfirm = () => {
    const toDelete = aliases.filter(a => selectedRows.includes(a.id));
    const hasReferences = toDelete.some(a => a.usageCount > 0);
    if (hasReferences) {
      toast.error('Cannot delete aliases that are in use by firewall rules');
      setDeleteDialogOpen(false);
      return;
    }
    toDelete.forEach(a => deleteMut.mutate(a.id));
    setSelectedRows([]);
    setDeleteDialogOpen(false);
    toast.success(`${toDelete.length} alias(es) deleted`);
  };

  const handleExportJSON = () => {
    exportToJSON(aliases, 'aliases-config.json');
    toast.success(`Exported ${aliases.length} aliases to JSON`);
  };

  const handleExportCSV = () => {
    const csvData = aliases.map(a => ({
      name: a.name,
      type: a.type,
      values: a.values.join('; '),
      description: a.description,
      usageCount: a.usageCount,
    }));
    exportToCSV(csvData, 'aliases-config.csv');
    toast.success(`Exported ${aliases.length} aliases to CSV`);
  };

  const handleImport = () => {
    createFileInput('.json', (file) => {
      importFromJSON<Alias>(
        file,
        (data) => {
          const newAliases = data.map(a => ({
            ...a,
            id: `alias-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            usageCount: 0,
            created: new Date(),
            updated: new Date(),
          }));
          setAliases(prev => [...prev, ...newAliases]);
          toast.success(`Imported ${newAliases.length} aliases`);
        },
        (error) => toast.error(error)
      );
    });
  };

  const onSubmit = (values: FormValues) => {
    const valuesArray = values.values
      .split(/[\n,]/)
      .map(v => v.trim())
      .filter(v => v !== '');

    const payload = {
      name: values.name,
      type: values.type,
      values: valuesArray,
      description: values.description,
    };

    if (editingAlias) {
      updateMut.mutate({ id: editingAlias.id, d: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const getTypeIcon = (type: Alias['type']) => {
    switch (type) {
      case 'host': return <Server size={14} />;
      case 'network': return <Network size={14} />;
      case 'port': return <Hash size={14} />;
    }
  };

  const getTypeColor = (type: Alias['type']) => {
    switch (type) {
      case 'host': return 'text-blue-600 bg-blue-100';
      case 'network': return 'text-emerald-600 bg-emerald-100';
      case 'port': return 'text-amber-600 bg-amber-100';
    }
  };

  const getPlaceholder = (type: string) => {
    switch (type) {
      case 'host': return '192.168.1.10\n192.168.1.11\n10.0.0.5';
      case 'network': return '192.168.1.0/24\n10.0.0.0/8';
      case 'port': return '80\n443\n8080-8090';
      default: return '';
    }
  };

  const toggleRowSelection = (id: string) => {
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const toggleAllRows = () => {
    if (selectedRows.length === filtered.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(filtered.map(a => a.id));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setAliases((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
      toast.success('Order updated');
    }
  };

  return (
    <Shell>
      <div className="space-y-4">
        {/* Toolbar - FortiGate Style */}
        <div className="forti-toolbar">
          <div className="forti-toolbar-left">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="forti-toolbar-btn primary">
                  + Create New
                  <ChevronDown size={12} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-white border shadow-lg z-50">
                <DropdownMenuItem onClick={() => handleAdd('host')} className="cursor-pointer">
                  <Server size={14} className="mr-2 text-blue-600" />
                  Address (Host)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAdd('network')} className="cursor-pointer">
                  <Network size={14} className="mr-2 text-emerald-600" />
                  Address (Subnet)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAdd('port')} className="cursor-pointer">
                  <Hash size={14} className="mr-2 text-amber-600" />
                  Service (Port)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              className="forti-toolbar-btn"
              onClick={() => {
                if (selectedRows.length === 1) {
                  const alias = aliases.find(a => a.id === selectedRows[0]);
                  if (alias) handleEdit(alias);
                }
              }}
              disabled={selectedRows.length !== 1}
            >
              ✏ Edit
            </button>

            <button
              className="forti-toolbar-btn"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={selectedRows.length === 0}
            >
              🗑 Delete
            </button>
          </div>

          <div className="forti-toolbar-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="forti-toolbar-btn">
                  Export
                  <ChevronDown size={12} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white border shadow-lg z-50">
                <DropdownMenuItem onClick={handleExportJSON} className="cursor-pointer">
                  Export as JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCSV} className="cursor-pointer">
                  Export as CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button className="forti-toolbar-btn" onClick={handleImport}>
              Import
            </button>
            
            <div className="forti-search">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-0 border-b border-[#ddd] bg-white">
          {(['all', 'host', 'network', 'port'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={cn(
                "px-4 py-2 text-[11px] font-medium border-b-2 -mb-px",
                filter === type
                  ? "border-[#4caf50] text-[#4caf50]"
                  : "border-transparent text-[#666] hover:text-[#333]"
              )}
            >
              {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
              <span className="ml-1.5 text-[10px] text-[#999]">({typeStats[type]})</span>
            </button>
          ))}
        </div>

        {/* Data Table */}
        <div className="section">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-6"></th>
                  <th className="w-10">
                    <input 
                      type="checkbox" 
                      checked={selectedRows.length === filtered.length && filtered.length > 0}
                      onChange={toggleAllRows}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th>Name</th>
                  <th className="w-24">Type</th>
                  <th>Members</th>
                  <th>Description</th>
                  <th className="w-20 text-center">Ref.</th>
                </tr>
              </thead>
              <SortableContext items={filtered.map(a => a.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {filtered.map((alias) => (
                    <SortableAliasRow
                      key={alias.id}
                      alias={alias}
                      isSelected={selectedRows.includes(alias.id)}
                      onSelect={toggleRowSelection}
                      getTypeIcon={getTypeIcon}
                      getTypeColor={getTypeColor}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>

          {filtered.length === 0 && (
            <div className="p-12 text-center">
              <Network size={32} className="mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No aliases found</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {search ? 'Try a different search term' : 'Create your first alias to get started'}
              </p>
            </div>
          )}
        </div>

        {/* Footer status */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{filtered.length} entries</span>
          {selectedRows.length > 0 && (
            <span>{selectedRows.length} selected</span>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network size={18} />
              {editingAlias ? 'Edit Alias' : 'New Address/Service'}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="LAN_SERVERS"
                        className="font-mono uppercase"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormDescription className="text-[10px]">
                      Uppercase letters, numbers, and underscores only
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <div className="grid grid-cols-3 gap-2">
                      {(['host', 'network', 'port'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => field.onChange(type)}
                          className={cn(
                            "flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors",
                            field.value === type
                              ? "border-[#4caf50] bg-[#4caf50]/10"
                              : "border-border/50 hover:bg-muted/50"
                          )}
                        >
                          <span className={getTypeColor(type)}>
                            {getTypeIcon(type)}
                          </span>
                          <span className="text-sm capitalize">{type}</span>
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="values"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Members</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={getPlaceholder(form.watch('type'))}
                        className="font-mono text-sm h-28 resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-[10px]">
                      One value per line, or comma-separated
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comments</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional description..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-[#4caf50] hover:bg-[#43a047]">
                  {editingAlias ? 'OK' : 'OK'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Alias(es)?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedRows.length} alias(es)? This action cannot be undone.
              Aliases that are referenced by firewall rules cannot be deleted.
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

export default Aliases;
