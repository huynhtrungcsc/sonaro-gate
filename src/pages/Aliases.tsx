import { useState, useEffect } from 'react';
import { useAliases } from '@/hooks/useDbData';
import { aliasesApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import {
  Plus, Edit2, Trash2, Search, Network, Server, Hash,
  ChevronDown, Download, Upload, RefreshCw,
} from 'lucide-react';
import { exportToJSON, exportToCSV, importFromJSON, createFileInput } from '@/lib/exportImport';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

interface Alias {
  id: string;
  name: string;
  type: 'host' | 'network' | 'port';
  values: string[];
  description: string;
  usageCount: number;
}

const formSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(32, 'Max 32 characters')
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Uppercase, start with a letter, only A-Z 0-9 _'),
  type: z.enum(['host', 'network', 'port']),
  values: z.string().min(1, 'At least one value is required'),
  description: z.string().max(200, 'Description too long'),
});

type FormValues = z.infer<typeof formSchema>;

const TYPE_META = {
  host:    { icon: Server,  label: 'Host',    color: 'text-blue-700 bg-blue-50 border-blue-200'    },
  network: { icon: Network, label: 'Network', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  port:    { icon: Hash,    label: 'Port',    color: 'text-amber-700 bg-amber-50 border-amber-200'  },
} as const;

const PLACEHOLDER: Record<string, string> = {
  host:    '192.168.1.10\n192.168.1.20\n10.0.0.5',
  network: '192.168.1.0/24\n10.0.0.0/8',
  port:    '80\n443\n8080-8090',
};

const FILTERS = ['all', 'host', 'network', 'port'] as const;
type Filter = typeof FILTERS[number];

const Aliases = () => {
  const { data: dbAliases, isLoading } = useAliases();
  const queryClient = useQueryClient();
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [filter, setFilter]   = useState<Filter>('all');
  const [search, setSearch]   = useState('');
  const [selected, setSelected]     = useState<string[]>([]);
  const [modalOpen, setModalOpen]   = useState(false);
  const [editingAlias, setEditingAlias] = useState<Alias | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exportMenu, setExportMenu] = useState(false);
  const [createMenu, setCreateMenu] = useState(false);

  const createMut = useMutation({
    mutationFn: (d: any) => aliasesApi.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['aliases'] }); setModalOpen(false); toast.success('Address created'); },
    onError: () => toast.error('Failed to create address'),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: any }) => aliasesApi.update(id, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['aliases'] }); setModalOpen(false); toast.success('Address updated'); },
    onError: () => toast.error('Failed to update address'),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => aliasesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['aliases'] }),
    onError: () => toast.error('Failed to delete address'),
  });

  useEffect(() => {
    if (dbAliases) {
      setAliases(dbAliases.map((a: any) => ({
        id: a.id,
        name: a.name,
        type: a.type as Alias['type'],
        values: a.values || [],
        description: a.description || '',
        usageCount: a.usage_count || 0,
      })));
    }
  }, [dbAliases]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', type: 'host', values: '', description: '' },
  });

  const counts = {
    all:     aliases.length,
    host:    aliases.filter(a => a.type === 'host').length,
    network: aliases.filter(a => a.type === 'network').length,
    port:    aliases.filter(a => a.type === 'port').length,
  };

  const filtered = aliases.filter(a => {
    const byType   = filter === 'all' || a.type === filter;
    const q        = search.toLowerCase();
    const bySearch = !q || a.name.toLowerCase().includes(q)
                       || a.description.toLowerCase().includes(q)
                       || a.values.some(v => v.includes(q));
    return byType && bySearch;
  });

  const openCreate = (type: Alias['type']) => {
    setEditingAlias(null);
    form.reset({ name: '', type, values: '', description: '' });
    setCreateMenu(false);
    setModalOpen(true);
  };

  const openEdit = () => {
    const a = aliases.find(x => x.id === selected[0]);
    if (!a) return;
    setEditingAlias(a);
    form.reset({ name: a.name, type: a.type, values: a.values.join('\n'), description: a.description });
    setModalOpen(true);
  };

  const onSubmit = (vals: FormValues) => {
    const valuesArr = vals.values.split(/[\n,]/).map(v => v.trim()).filter(Boolean);
    const payload = { name: vals.name, type: vals.type, values: valuesArr, description: vals.description };
    if (editingAlias) updateMut.mutate({ id: editingAlias.id, d: payload });
    else createMut.mutate(payload);
  };

  const handleDeleteConfirm = () => {
    const toDelete = aliases.filter(a => selected.includes(a.id));
    if (toDelete.some(a => a.usageCount > 0)) {
      toast.error('Cannot delete addresses that are referenced by firewall rules');
      setDeleteOpen(false);
      return;
    }
    toDelete.forEach(a => deleteMut.mutate(a.id));
    setSelected([]);
    setDeleteOpen(false);
    toast.success(`${toDelete.length} address(es) deleted`);
  };

  const handleExportJSON = () => { exportToJSON(aliases, 'addresses.json'); setExportMenu(false); toast.success('Exported JSON'); };
  const handleExportCSV  = () => {
    exportToCSV(aliases.map(a => ({ name: a.name, type: a.type, values: a.values.join('; '), description: a.description })), 'addresses.csv');
    setExportMenu(false);
    toast.success('Exported CSV');
  };
  const handleImport = () => {
    createFileInput('.json', (file) => {
      importFromJSON<Alias>(file,
        (data) => {
          setAliases(prev => [...prev, ...data.map(a => ({ ...a, id: `alias-${Date.now()}-${Math.random().toString(36).substr(2,9)}`, usageCount: 0 }))]);
          toast.success(`Imported ${data.length} addresses`);
        },
        (err) => toast.error(err)
      );
    });
  };

  const toggleRow  = (id: string) => setSelected(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);
  const toggleAll  = () => setSelected(p => p.length === filtered.length ? [] : filtered.map(a => a.id));

  const TypeBadge = ({ type }: { type: Alias['type'] }) => {
    const m = TYPE_META[type];
    const Icon = m.icon;
    return (
      <span className={cn("forti-tag flex items-center gap-1", m.color)}>
        <Icon className="w-3 h-3" />
        {m.label}
      </span>
    );
  };

  return (
    <Shell>
      <div className="space-y-0 animate-slide-in">

        {/* ── Toolbar ─────────────────────────────────────────────────── */}
        <div className="forti-toolbar">

          {/* Create New dropdown */}
          <div className="relative">
            <button
              data-testid="button-create-address"
              className="forti-toolbar-btn primary"
              onClick={() => setCreateMenu(v => !v)}
            >
              <Plus className="w-3 h-3" />
              Create New
              <ChevronDown className="w-3 h-3" />
            </button>
            {createMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#ccc] shadow-lg z-50 min-w-[180px]">
                {(['host', 'network', 'port'] as const).map(t => {
                  const m = TYPE_META[t];
                  const Icon = m.icon;
                  return (
                    <button
                      key={t}
                      className="w-full px-3 py-2 text-left text-[11px] hover:bg-[#f0f0f0] flex items-center gap-2"
                      onClick={() => openCreate(t)}
                    >
                      <Icon className={cn("w-3 h-3", m.color.split(' ')[0])} />
                      {m.label} Address
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            data-testid="button-edit-address"
            className="forti-toolbar-btn"
            disabled={selected.length !== 1}
            onClick={openEdit}
          >
            <Edit2 className="w-3 h-3" /> Edit
          </button>

          <button
            data-testid="button-delete-address"
            className="forti-toolbar-btn"
            disabled={selected.length === 0}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="w-3 h-3" /> Delete
          </button>

          <div className="forti-toolbar-separator" />

          {/* Export dropdown */}
          <div className="relative">
            <button
              data-testid="button-export-address"
              className="forti-toolbar-btn"
              onClick={() => setExportMenu(v => !v)}
            >
              <Download className="w-3 h-3" />
              Export
              <ChevronDown className="w-3 h-3" />
            </button>
            {exportMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#ccc] shadow-lg z-50 min-w-[160px]">
                <button className="w-full px-3 py-2 text-left text-[11px] hover:bg-[#f0f0f0]" onClick={handleExportJSON}>Export as JSON</button>
                <button className="w-full px-3 py-2 text-left text-[11px] hover:bg-[#f0f0f0]" onClick={handleExportCSV}>Export as CSV</button>
              </div>
            )}
          </div>

          <button data-testid="button-import-address" className="forti-toolbar-btn" onClick={handleImport}>
            <Upload className="w-3 h-3" /> Import
          </button>

          <button
            className="forti-toolbar-btn"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['aliases'] })}
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>

          <div className="flex-1" />

          <div className="forti-search">
            <Search className="w-3 h-3 text-[#999]" />
            <input
              data-testid="input-search-address"
              type="text"
              placeholder="Search…"
              className="w-40"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* ── Filter tabs ──────────────────────────────────────────────── */}
        <div className="flex items-stretch bg-[#e8e8e8] border-b border-[#ccc]">
          {FILTERS.map(f => (
            <button
              key={f}
              data-testid={`tab-address-${f}`}
              onClick={() => { setFilter(f); setSelected([]); }}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 text-[11px] font-medium transition-colors border-b-2",
                filter === f
                  ? "bg-white text-[hsl(142,70%,35%)] border-[hsl(142,70%,35%)]"
                  : "text-[#666] border-transparent hover:text-[#333] hover:bg-[#f0f0f0]"
              )}
            >
              {f === 'all' ? 'All' : TYPE_META[f as Alias['type']].label}
              <span className={cn(
                "px-1.5 py-0.5 text-[10px] rounded",
                filter === f
                  ? "bg-[hsl(142,70%,35%)]/20 text-[hsl(142,70%,35%)]"
                  : "bg-[#ddd] text-[#666]"
              )}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>

        {/* ── Data table ───────────────────────────────────────────────── */}
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-8">
                <input
                  type="checkbox"
                  className="forti-checkbox"
                  checked={filtered.length > 0 && selected.length === filtered.length}
                  onChange={toggleAll}
                />
              </th>
              <th>Name</th>
              <th className="w-24">Type</th>
              <th>Members</th>
              <th>Description</th>
              <th className="w-16 text-center">Ref.</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="text-center py-8 text-[#999] text-[11px]">Loading…</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center py-14 text-[#999]">
                <Network className="w-10 h-10 mx-auto mb-2 opacity-25" />
                <div className="text-[12px] mb-1">No addresses found</div>
                <div className="text-[10px] mb-3">
                  {search ? 'Try a different search term' : 'Click Create New to add a Host, Network, or Port address'}
                </div>
              </td></tr>
            )}
            {filtered.map(alias => {
              const Icon = TYPE_META[alias.type].icon;
              return (
                <tr
                  key={alias.id}
                  data-testid={`row-address-${alias.id}`}
                  className={cn(selected.includes(alias.id) && "selected")}
                  onClick={() => toggleRow(alias.id)}
                >
                  <td onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="forti-checkbox"
                      checked={selected.includes(alias.id)}
                      onChange={() => toggleRow(alias.id)}
                    />
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className={cn("p-1 rounded", TYPE_META[alias.type].color)}>
                        <Icon className="w-3 h-3" />
                      </span>
                      <span className="font-mono font-semibold text-[11px]">{alias.name}</span>
                    </div>
                  </td>
                  <td><TypeBadge type={alias.type} /></td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {alias.values.slice(0, 4).map((v, i) => (
                        <span key={i} className="px-1.5 py-0.5 text-[10px] font-mono bg-[#f0f0f0] border border-[#ddd] rounded">
                          {v}
                        </span>
                      ))}
                      {alias.values.length > 4 && (
                        <span className="px-1.5 py-0.5 text-[10px] text-[#999]">
                          +{alias.values.length - 4} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-[11px] text-[#666]">{alias.description}</td>
                  <td className="text-center">
                    <span className={cn(
                      "text-[11px] font-mono font-medium",
                      alias.usageCount > 0 ? "text-blue-600" : "text-[#bbb]"
                    )}>
                      {alias.usageCount}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ── Footer count ─────────────────────────────────────────────── */}
        <div className="px-3 py-1.5 bg-[#f8f8f8] border-t border-[#e0e0e0] flex items-center justify-between text-[10px] text-[#999]">
          <span>{filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}</span>
          {selected.length > 0 && <span>{selected.length} selected</span>}
        </div>
      </div>

      {/* ── Create / Edit modal ─────────────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[13px]">
              <Network className="w-4 h-4" />
              {editingAlias ? 'Edit Address' : 'New Address'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 text-[11px]">

            {/* Name */}
            <div>
              <label className="block font-medium mb-1 text-[#555]">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                data-testid="input-address-name"
                className="forti-input w-full font-mono uppercase"
                placeholder="LAN_SERVERS"
                {...form.register('name')}
                onChange={e => form.setValue('name', e.target.value.toUpperCase(), { shouldValidate: true })}
              />
              {form.formState.errors.name && (
                <p className="text-red-500 text-[10px] mt-1">{form.formState.errors.name.message}</p>
              )}
              <p className="text-[10px] text-[#999] mt-1">Uppercase letters, numbers, underscores — start with a letter</p>
            </div>

            {/* Type selector */}
            <div>
              <label className="block font-medium mb-1 text-[#555]">Type</label>
              <div className="grid grid-cols-3 gap-2">
                {(['host', 'network', 'port'] as const).map(t => {
                  const m = TYPE_META[t];
                  const Icon = m.icon;
                  const active = form.watch('type') === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => form.setValue('type', t)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 py-3 rounded border transition-colors",
                        active
                          ? "border-[hsl(142,70%,35%)] bg-[hsl(142,70%,35%)]/10 text-[hsl(142,70%,35%)]"
                          : "border-[#ddd] hover:bg-[#f5f5f5] text-[#555]"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[10px] font-medium">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Values */}
            <div>
              <label className="block font-medium mb-1 text-[#555]">
                Members <span className="text-red-500">*</span>
              </label>
              <textarea
                data-testid="input-address-values"
                className="forti-input w-full font-mono h-24 resize-none"
                placeholder={PLACEHOLDER[form.watch('type')] || ''}
                {...form.register('values')}
              />
              {form.formState.errors.values && (
                <p className="text-red-500 text-[10px] mt-1">{form.formState.errors.values.message}</p>
              )}
              <p className="text-[10px] text-[#999] mt-1">One value per line, or comma-separated</p>
            </div>

            {/* Description */}
            <div>
              <label className="block font-medium mb-1 text-[#555]">Comments</label>
              <input
                data-testid="input-address-desc"
                className="forti-input w-full"
                placeholder="Optional description…"
                {...form.register('description')}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#e0e0e0]">
              <button type="button" className="forti-toolbar-btn" onClick={() => setModalOpen(false)}>Cancel</button>
              <button
                data-testid="button-address-submit"
                type="submit"
                className="forti-toolbar-btn primary"
                disabled={createMut.isPending || updateMut.isPending}
              >
                {(createMut.isPending || updateMut.isPending) ? 'Saving…' : 'OK'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ───────────────────────────────────────────── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.length} address{selected.length !== 1 ? 'es' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Addresses referenced by firewall rules cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
};

export default Aliases;
