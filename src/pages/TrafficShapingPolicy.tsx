import { useState } from 'react';
import { useTrafficShapingPolicies } from '@/hooks/useDbData';
import { trafficShapingPoliciesApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/formatters';
import { FortiToggle } from '@/components/ui/forti-toggle';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  RefreshCw,
  Search,
  ArrowUpDown,
  Network
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ShapingPolicy {
  id: string;
  name: string;
  srcInterface: string;
  dstInterface: string;
  source: string;
  destination: string;
  service: string;
  application: string;
  trafficShaper: string;
  reverseShaper: string;
  perIPShaper: string;
  enabled: boolean;
  matches: number;
  bytes: number;
}

const TrafficShapingPolicy = () => {
  const queryClient = useQueryClient();
  const { data: policies = [] } = useTrafficShapingPolicies();
  const createMut = useMutation({ mutationFn: (d: any) => trafficShapingPoliciesApi.create(d), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['traffic-shaping-policies'] }); setModalOpen(false); toast.success('Policy created'); }, onError: () => toast.error('Failed to create policy') });
  const updateMut = useMutation({ mutationFn: ({ id, d }: { id: string; d: any }) => trafficShapingPoliciesApi.update(id, d), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['traffic-shaping-policies'] }); setModalOpen(false); toast.success('Policy updated'); }, onError: () => toast.error('Failed to update policy') });
  const deleteMut = useMutation({ mutationFn: (id: string) => trafficShapingPoliciesApi.delete(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['traffic-shaping-policies'] }), onError: () => toast.error('Failed to delete policy') });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<ShapingPolicy | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSrcInterface, setFormSrcInterface] = useState('LAN (port1)');
  const [formDstInterface, setFormDstInterface] = useState('WAN1 (wan1)');
  const [formSource, setFormSource] = useState('all');
  const [formDestination, setFormDestination] = useState('all');
  const [formService, setFormService] = useState('ALL');
  const [formApplication, setFormApplication] = useState('');
  const [formShaper, setFormShaper] = useState('');
  const [formReverseShaper, setFormReverseShaper] = useState('');
  const [formPerIPShaper, setFormPerIPShaper] = useState('');

  const togglePolicy = (id: string) => {
    const policy = (policies as any[]).find((p: any) => p.id === id);
    if (policy) updateMut.mutate({ id, d: { enabled: !policy.enabled } });
  };

  const handleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const openCreateModal = () => {
    setEditingPolicy(null);
    setFormName(''); setFormSrcInterface('LAN (port1)'); setFormDstInterface('WAN1 (wan1)');
    setFormSource('all'); setFormDestination('all'); setFormService('ALL');
    setFormApplication(''); setFormShaper(''); setFormReverseShaper(''); setFormPerIPShaper('');
    setModalOpen(true);
  };

  const openEditModal = () => {
    if (selectedIds.length !== 1) return;
    const p = policies.find(p => p.id === selectedIds[0]);
    if (!p) return;
    setEditingPolicy(p);
    setFormName(p.name); setFormSrcInterface((p as any).src_interface ?? (p as any).srcInterface ?? ''); setFormDstInterface((p as any).dst_interface ?? (p as any).dstInterface ?? '');
    setFormSource(p.source); setFormDestination(p.destination); setFormService(p.service);
    setFormApplication((p as any).application); setFormShaper((p as any).traffic_shaper ?? (p as any).trafficShaper ?? '');
    setFormReverseShaper((p as any).reverse_shaper ?? (p as any).reverseShaper ?? ''); setFormPerIPShaper((p as any).per_ip_shaper ?? (p as any).perIPShaper ?? '');
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!formName.trim()) { toast.error('Name is required'); return; }
    const dbData = { name: formName, src_interface: formSrcInterface, dst_interface: formDstInterface, source: formSource, destination: formDestination, service: formService, application: formApplication, traffic_shaper: formShaper, reverse_shaper: formReverseShaper, per_ip_shaper: formPerIPShaper };
    if (editingPolicy) {
      updateMut.mutate({ id: editingPolicy.id, d: dbData });
    } else {
      createMut.mutate({ ...dbData, enabled: true, matches: 0, bytes: 0 });
    }
  };

  const filteredPolicies = (policies as any[]).filter((policy: any) => 
    searchQuery === '' ||
    policy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (policy.application ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    ((policy.traffic_shaper ?? policy.trafficShaper) ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Shell>
      <div className="space-y-0 animate-slide-in">
        {/* FortiGate Toolbar */}
        <div className="forti-toolbar">
          <button className="forti-toolbar-btn primary" onClick={openCreateModal}>
            <Plus className="w-3 h-3" />
            Create New
          </button>
          <button className="forti-toolbar-btn" disabled={selectedIds.length !== 1} onClick={openEditModal}>
            <Edit2 className="w-3 h-3" />
            Edit
          </button>
          <button 
            className="forti-toolbar-btn" 
            disabled={selectedIds.length === 0}
            onClick={() => {
              selectedIds.forEach(id => deleteMut.mutate(id));
              toast.success(`Deleted ${selectedIds.length} policy(ies)`);
              setSelectedIds([]);
            }}
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={() => queryClient.invalidateQueries({ queryKey: ['traffic-shaping-policies'] }).then(() => toast.success('Refreshed'))}>
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
                    checked={filteredPolicies.length > 0 && selectedIds.length === filteredPolicies.length}
                    onChange={() => {
                      if (selectedIds.length === filteredPolicies.length) {
                        setSelectedIds([]);
                      } else {
                        setSelectedIds(filteredPolicies.map((p: any) => p.id));
                      }
                    }}
                  />
                </th>
                <th className="w-16">Status</th>
                <th className="w-10">ID</th>
                <th>Name</th>
                <th>Source</th>
                <th>Destination</th>
                <th>Application</th>
                <th>Shaper</th>
                <th className="text-right">Matches</th>
                <th className="text-right">Bytes</th>
              </tr>
            </thead>
            <tbody>
              {filteredPolicies.map((policy, index) => (
                <tr key={policy.id} className={cn(!policy.enabled && "opacity-60", selectedIds.includes(policy.id) && "selected")}>
                  <td>
                    <input 
                      type="checkbox" 
                      className="forti-checkbox"
                      checked={selectedIds.includes(policy.id)}
                      onChange={() => handleSelect(policy.id)}
                    />
                  </td>
                  <td>
                    <FortiToggle 
                      enabled={policy.enabled} 
                      onToggle={() => togglePolicy(policy.id)}
                      size="sm"
                    />
                  </td>
                  <td className="text-[11px] text-[#666]">{index + 1}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <ArrowUpDown className="w-3 h-3 text-cyan-600" />
                      <span className="text-[11px] font-medium">{policy.name}</span>
                    </div>
                  </td>
                  <td>
                    <div>
                      <span className="inline-flex items-center gap-1 text-[11px]">
                        <span className="w-3 h-3 bg-green-400 rounded-sm" />
                        {policy.source}
                      </span>
                      <div className="text-[10px] text-[#999]">{(policy as any).src_interface ?? (policy as any).srcInterface}</div>
                    </div>
                  </td>
                  <td>
                    <div>
                      <span className="inline-flex items-center gap-1 text-[11px]">
                        <Network className="w-3 h-3" />
                        {policy.destination}
                      </span>
                      <div className="text-[10px] text-[#999]">{(policy as any).dst_interface ?? (policy as any).dstInterface}</div>
                    </div>
                  </td>
                  <td>
                    <span className="forti-tag bg-purple-100 text-purple-700 border-purple-200">
                      {policy.application}
                    </span>
                  </td>
                  <td>
                    {((policy as any).traffic_shaper ?? (policy as any).trafficShaper) ? (
                      <span className="forti-tag bg-orange-100 text-orange-700 border-orange-200">
                        {(policy as any).traffic_shaper ?? (policy as any).trafficShaper}
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#999]">—</span>
                    )}
                  </td>
                  <td className="text-right text-[11px] text-[#666]">{((policy as any).matches ?? 0).toLocaleString()}</td>
                  <td className="text-right text-[11px] text-[#666]">{formatBytes((policy as any).bytes ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[11px] text-[#666] mt-2 px-1">
            {filteredPolicies.length} shaping policies
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="forti-modal-header">
            <DialogTitle className="text-sm font-semibold">
              {editingPolicy ? 'Edit Shaping Policy' : 'Create Shaping Policy'}
            </DialogTitle>
          </DialogHeader>
          <div className="forti-modal-body space-y-3">
            <div className="grid grid-cols-3 gap-2 items-center">
              <label className="forti-label text-right">Name</label>
              <div className="col-span-2">
                <input className="forti-input w-full" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Policy name" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <label className="forti-label text-right">Source Interface</label>
              <div className="col-span-2">
                <input className="forti-input w-full" value={formSrcInterface} onChange={e => setFormSrcInterface(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <label className="forti-label text-right">Dest Interface</label>
              <div className="col-span-2">
                <input className="forti-input w-full" value={formDstInterface} onChange={e => setFormDstInterface(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <label className="forti-label text-right">Source</label>
              <div className="col-span-2">
                <input className="forti-input w-full" value={formSource} onChange={e => setFormSource(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <label className="forti-label text-right">Destination</label>
              <div className="col-span-2">
                <input className="forti-input w-full" value={formDestination} onChange={e => setFormDestination(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <label className="forti-label text-right">Application</label>
              <div className="col-span-2">
                <input className="forti-input w-full" value={formApplication} onChange={e => setFormApplication(e.target.value)} placeholder="e.g. YouTube, VoIP" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <label className="forti-label text-right">Traffic Shaper</label>
              <div className="col-span-2">
                <input className="forti-input w-full" value={formShaper} onChange={e => setFormShaper(e.target.value)} placeholder="Shaper name" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <label className="forti-label text-right">Reverse Shaper</label>
              <div className="col-span-2">
                <input className="forti-input w-full" value={formReverseShaper} onChange={e => setFormReverseShaper(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <label className="forti-label text-right">Per-IP Shaper</label>
              <div className="col-span-2">
                <input className="forti-input w-full" value={formPerIPShaper} onChange={e => setFormPerIPShaper(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="forti-modal-footer">
            <button className="forti-toolbar-btn" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="forti-toolbar-btn primary" onClick={handleSave}>
              {editingPolicy ? 'Save' : 'Create'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Shell>
  );
};

export default TrafficShapingPolicy;
