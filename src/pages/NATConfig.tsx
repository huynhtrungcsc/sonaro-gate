import { useState } from 'react';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { FortiToggle } from '@/components/ui/forti-toggle';
import {
  ChevronDown, Plus, Edit2, Trash2, RefreshCw, Search,
  ArrowRightLeft, Globe, Network, Play,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNATRules } from '@/hooks/useDbData';
import { natRulesApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';

interface NatFormState {
  type: string;
  interface: string;
  protocol: string;
  external_address: string;
  external_port: string;
  internal_address: string;
  internal_port: string;
  description: string;
  enabled: boolean;
}

const DEFAULT_NAT_FORM: NatFormState = {
  type: 'port-forward',
  interface: 'WAN',
  protocol: 'tcp',
  external_address: '',
  external_port: '',
  internal_address: '',
  internal_port: '',
  description: '',
  enabled: true,
};

const INTERFACES = ['WAN', 'WAN1', 'WAN2', 'LAN', 'DMZ', 'any'];
const PROTOCOLS  = ['tcp', 'udp', 'tcp/udp'];

const TAB_META = [
  { id: 'port-forward', label: 'Port Forward',   icon: ArrowRightLeft,
    desc: 'Forward external port → internal host:port (DNAT)' },
  { id: 'outbound',     label: 'Outbound NAT',   icon: Globe,
    desc: 'Translate source IP/port when traffic leaves a WAN interface (SNAT / Masquerade)' },
  { id: '1:1',          label: '1:1 NAT',        icon: Network,
    desc: 'Static one-to-one mapping: one public IP ↔ one private IP (bidirectional)' },
  { id: 'npt',          label: 'NPt (IPv6)',      icon: Network,
    desc: 'Network Prefix Translation — rewrite IPv6 prefixes without stateful tracking' },
] as const;

type TabId = typeof TAB_META[number]['id'];

const NATConfig = () => {
  const [activeTab, setActiveTab]         = useState<TabId>('port-forward');
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [selectedIds, setSelectedIds]     = useState<string[]>([]);
  const [searchQuery, setSearchQuery]     = useState('');
  const [modalOpen, setModalOpen]         = useState(false);
  const [editingRule, setEditingRule]     = useState<any>(null);
  const [form, setForm]                   = useState<NatFormState>(DEFAULT_NAT_FORM);

  const queryClient = useQueryClient();
  const { data: rules = [], isLoading } = useNATRules();

  const createMut = useMutation({
    mutationFn: (d: any) => natRulesApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nat-rules'] });
      setModalOpen(false);
      toast.success('NAT rule created');
    },
    onError: () => toast.error('Failed to create rule'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: any }) => natRulesApi.update(id, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nat-rules'] });
      setModalOpen(false);
      toast.success('NAT rule updated');
    },
    onError: () => toast.error('Failed to update rule'),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      natRulesApi.update(id, { enabled } as any),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nat-rules'] }),
    onError: () => toast.error('Failed to toggle rule'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => natRulesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nat-rules'] });
      setSelectedIds([]);
      toast.success('Rule deleted');
    },
    onError: () => toast.error('Failed to delete rule'),
  });

  const applyMut = useMutation({
    mutationFn: () => apiRequest('POST', '/api/system/apply-nat-rules'),
    onSuccess: () => toast.success('NAT rules applied to system'),
    onError: () => toast.error('Apply failed — server may not be running as root'),
  });

  const openCreate = (type: string) => {
    setEditingRule(null);
    setForm({ ...DEFAULT_NAT_FORM, type });
    setShowCreateMenu(false);
    setModalOpen(true);
  };

  const openEdit = () => {
    const rule = (rules as any[]).find((r: any) => r.id === selectedIds[0]);
    if (!rule) return;
    setEditingRule(rule);
    setForm({
      type:             rule.type,
      interface:        rule.interface,
      protocol:         rule.protocol || 'tcp',
      external_address: rule.external_address || '',
      external_port:    rule.external_port    || '',
      internal_address: rule.internal_address || '',
      internal_port:    rule.internal_port    || '',
      description:      rule.description      || '',
      enabled:          rule.enabled,
    });
    setModalOpen(true);
  };

  const handleSubmit = () => {
    if (form.type === 'port-forward' || form.type === 'outbound') {
      if (!form.internal_address) {
        toast.error('Internal address is required');
        return;
      }
      if (form.type === 'port-forward' && (!form.external_port || !form.internal_port)) {
        toast.error('External port and internal port are required for port forwarding');
        return;
      }
    }
    if ((form.type === '1:1') && (!form.external_address || !form.internal_address)) {
      toast.error('Both external and internal IP addresses are required for 1:1 NAT');
      return;
    }
    if (editingRule) {
      updateMut.mutate({ id: editingRule.id, d: form });
    } else {
      createMut.mutate(form);
    }
  };

  const toggleRule = (id: string, current: boolean) =>
    toggleMut.mutate({ id, enabled: !current });

  const filteredRules = (rules as any[]).filter((r) => {
    if (r.type !== activeTab) return false;
    const q = searchQuery.toLowerCase();
    return !q || (r.description ?? '').toLowerCase().includes(q)
                || (r.internal_address ?? '').includes(q)
                || (r.external_port ?? '').includes(q)
                || (r.external_address ?? '').includes(q);
  });

  const tabCount = (id: string) => (rules as any[]).filter((r) => r.type === id).length;

  const SelectionCheckbox = ({ id }: { id: string }) => (
    <input
      type="checkbox"
      className="forti-checkbox"
      checked={selectedIds.includes(id)}
      onChange={() => setSelectedIds(prev =>
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])}
      onClick={e => e.stopPropagation()}
    />
  );

  const RowToggle = ({ rule }: { rule: any }) => (
    <td onClick={e => e.stopPropagation()}>
      <FortiToggle enabled={rule.enabled} onToggle={() => toggleRule(rule.id, rule.enabled)} size="sm" />
    </td>
  );

  const IfaceBadge = ({ iface }: { iface: string }) => (
    <span className="forti-tag bg-blue-100 text-blue-700 border-blue-200">{iface}</span>
  );

  return (
    <Shell>
      <div className="space-y-0 animate-slide-in">
        {/* ── Toolbar ────────────────────────────────────────────────────── */}
        <div className="forti-toolbar">
          {/* Create dropdown */}
          <div className="relative">
            <button
              data-testid="button-create-nat"
              className="forti-toolbar-btn primary"
              onClick={() => setShowCreateMenu(!showCreateMenu)}
            >
              <Plus className="w-3 h-3" />
              Create New
              <ChevronDown className="w-3 h-3" />
            </button>
            {showCreateMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#ccc] shadow-lg z-50 min-w-[200px]">
                {[
                  { label: 'Port Forward Rule',  icon: ArrowRightLeft, type: 'port-forward' },
                  { label: 'Outbound NAT Rule',   icon: Globe,          type: 'outbound'     },
                  { label: '1:1 NAT Mapping',     icon: Network,        type: '1:1'          },
                  { label: 'NPt Rule (IPv6)',      icon: Network,        type: 'npt'          },
                ].map(item => (
                  <button
                    key={item.type}
                    className="w-full px-3 py-2 text-left text-[11px] hover:bg-[#f0f0f0] flex items-center gap-2"
                    onClick={() => openCreate(item.type)}
                  >
                    <item.icon className="w-3 h-3" />
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            data-testid="button-edit-nat"
            className="forti-toolbar-btn"
            disabled={selectedIds.length !== 1}
            onClick={openEdit}
          >
            <Edit2 className="w-3 h-3" /> Edit
          </button>
          <button
            data-testid="button-delete-nat"
            className="forti-toolbar-btn"
            disabled={selectedIds.length === 0}
            onClick={() => { selectedIds.forEach(id => deleteMut.mutate(id)); }}
          >
            <Trash2 className="w-3 h-3" /> Delete
          </button>

          <div className="forti-toolbar-separator" />

          <button
            data-testid="button-apply-nat"
            className="forti-toolbar-btn"
            onClick={() => applyMut.mutate()}
            disabled={applyMut.isPending}
            title="Push all enabled NAT rules to iptables"
          >
            <Play className="w-3 h-3" />
            {applyMut.isPending ? 'Applying…' : 'Apply to System'}
          </button>
          <button
            className="forti-toolbar-btn"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['nat-rules'] })}
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>

          <div className="flex-1" />
          <div className="forti-search">
            <Search className="w-3 h-3 text-[#999]" />
            <input
              data-testid="input-search-nat"
              type="text"
              placeholder="Search…"
              className="w-40"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* ── Tab bar ────────────────────────────────────────────────────── */}
        <div className="flex items-stretch bg-[#e8e8e8] border-b border-[#ccc]">
          {TAB_META.map(tab => (
            <button
              key={tab.id}
              data-testid={`tab-nat-${tab.id}`}
              onClick={() => { setActiveTab(tab.id); setSelectedIds([]); }}
              title={tab.desc}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 text-[11px] font-medium transition-colors border-b-2",
                activeTab === tab.id
                  ? "bg-white text-[hsl(142,70%,35%)] border-[hsl(142,70%,35%)]"
                  : "text-[#666] border-transparent hover:text-[#333] hover:bg-[#f0f0f0]"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              <span className={cn(
                "px-1.5 py-0.5 text-[10px] rounded",
                activeTab === tab.id
                  ? "bg-[hsl(142,70%,35%)]/20 text-[hsl(142,70%,35%)]"
                  : "bg-[#ddd] text-[#666]"
              )}>
                {tabCount(tab.id)}
              </span>
            </button>
          ))}
        </div>

        {/* ── Desc bar ───────────────────────────────────────────────────── */}
        <div className="px-3 py-1.5 bg-[#f8f8f8] border-b border-[#e0e0e0] text-[10px] text-[#777]">
          {TAB_META.find(t => t.id === activeTab)?.desc}
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* Port Forward Tab                                               */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'port-forward' && (
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-8">
                  <input type="checkbox" className="forti-checkbox"
                    onChange={e => setSelectedIds(e.target.checked ? filteredRules.map((r: any) => r.id) : [])} />
                </th>
                <th className="w-16">Status</th>
                <th>Interface</th>
                <th>Protocol</th>
                <th>Ext. Port</th>
                <th>Internal Address</th>
                <th>Int. Port</th>
                <th>iptables equivalent</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={9} className="text-center py-8 text-[#999] text-[11px]">Loading…</td></tr>
              )}
              {!isLoading && filteredRules.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8 text-[#999] text-[11px]">
                  No port forward rules — click <strong>Create New → Port Forward Rule</strong> to add one
                </td></tr>
              )}
              {filteredRules.map((rule: any) => (
                <tr
                  key={rule.id}
                  data-testid={`row-nat-portfwd-${rule.id}`}
                  className={cn(!rule.enabled && "opacity-60", selectedIds.includes(rule.id) && "selected")}
                  onClick={() => setSelectedIds(prev =>
                    prev.includes(rule.id) ? prev.filter(i => i !== rule.id) : [...prev, rule.id])}
                >
                  <td><SelectionCheckbox id={rule.id} /></td>
                  <RowToggle rule={rule} />
                  <td><IfaceBadge iface={rule.interface} /></td>
                  <td className="font-mono text-[11px]">{(rule.protocol ?? 'tcp').toUpperCase()}</td>
                  <td className="font-mono text-[11px]">{rule.external_port}</td>
                  <td className="font-mono text-[11px]">{rule.internal_address}</td>
                  <td className="font-mono text-[11px]">{rule.internal_port}</td>
                  <td className="font-mono text-[10px] text-[#888]">
                    -p {rule.protocol || 'tcp'} --dport {rule.external_port} -j DNAT --to {rule.internal_address}:{rule.internal_port}
                  </td>
                  <td className="text-[11px]">{rule.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* Outbound NAT Tab                                               */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'outbound' && (
          <div className="p-4 space-y-4">
            <div className="section">
              <div className="section-header-neutral">
                <span>Outbound NAT Mode</span>
              </div>
              <div className="section-body">
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { mode: 'Automatic', desc: 'System auto-creates MASQUERADE rules for all LAN → WAN traffic' },
                    { mode: 'Hybrid',    desc: 'Automatic rules + manual SNAT mappings for specific hosts' },
                    { mode: 'Manual',    desc: 'Full manual control — only rules you create will be applied' },
                  ].map(({ mode, desc }) => (
                    <label key={mode} className="flex items-start gap-3 p-4 bg-[#f8f8f8] border border-[#ddd] cursor-pointer hover:border-[hsl(142,70%,35%)] transition-colors">
                      <input type="radio" name="nat-mode" defaultChecked={mode === 'Automatic'} className="mt-0.5" />
                      <div>
                        <div className="font-medium text-[11px]">{mode} Outbound NAT</div>
                        <div className="text-[10px] text-[#666] mt-1">{desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-8"><input type="checkbox" className="forti-checkbox" /></th>
                  <th className="w-16">Status</th>
                  <th>Interface</th>
                  <th>Source Network</th>
                  <th>NAT Address</th>
                  <th>iptables equivalent</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-[#999] text-[11px]">
                    No outbound NAT rules — click <strong>Create New → Outbound NAT Rule</strong>
                  </td></tr>
                )}
                {filteredRules.map((rule: any) => (
                  <tr key={rule.id} data-testid={`row-nat-outbound-${rule.id}`}>
                    <td><SelectionCheckbox id={rule.id} /></td>
                    <RowToggle rule={rule} />
                    <td><IfaceBadge iface={rule.interface} /></td>
                    <td className="font-mono text-[11px]">{rule.internal_address || 'any'}</td>
                    <td className="font-mono text-[11px]">{rule.external_address || 'MASQUERADE'}</td>
                    <td className="font-mono text-[10px] text-[#888]">
                      -s {rule.internal_address || '0.0.0.0/0'} -o {rule.interface} -j {rule.external_address ? `SNAT --to-source ${rule.external_address}` : 'MASQUERADE'}
                    </td>
                    <td className="text-[11px]">{rule.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 1:1 NAT Tab                                                    */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === '1:1' && (
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-8">
                  <input type="checkbox" className="forti-checkbox"
                    onChange={e => setSelectedIds(e.target.checked ? filteredRules.map((r: any) => r.id) : [])} />
                </th>
                <th className="w-16">Status</th>
                <th>Interface</th>
                <th>External IP (Public)</th>
                <th>Internal IP (Private)</th>
                <th>Direction</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="text-center py-8 text-[#999] text-[11px]">Loading…</td></tr>
              )}
              {!isLoading && filteredRules.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-[#999]">
                  <Network className="w-10 h-10 mx-auto mb-2 opacity-25" />
                  <div className="text-[12px] mb-1">No 1:1 NAT mappings</div>
                  <div className="text-[10px] mb-3">Maps one public IP to one private IP — bidirectional</div>
                  <button className="forti-toolbar-btn primary" onClick={() => openCreate('1:1')}>
                    <Plus className="w-3 h-3 inline mr-1" /> Add 1:1 NAT Mapping
                  </button>
                </td></tr>
              )}
              {filteredRules.map((rule: any) => (
                <tr
                  key={rule.id}
                  data-testid={`row-nat-1to1-${rule.id}`}
                  className={cn(!rule.enabled && "opacity-60", selectedIds.includes(rule.id) && "selected")}
                  onClick={() => setSelectedIds(prev =>
                    prev.includes(rule.id) ? prev.filter(i => i !== rule.id) : [...prev, rule.id])}
                >
                  <td><SelectionCheckbox id={rule.id} /></td>
                  <RowToggle rule={rule} />
                  <td><IfaceBadge iface={rule.interface} /></td>
                  <td className="font-mono text-[11px]">{rule.external_address}</td>
                  <td className="font-mono text-[11px]">{rule.internal_address}</td>
                  <td>
                    <span className="forti-tag bg-purple-100 text-purple-700 border-purple-200">
                      Bidirectional
                    </span>
                  </td>
                  <td className="text-[11px]">{rule.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* NPt IPv6 Tab                                                   */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'npt' && (
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-8">
                  <input type="checkbox" className="forti-checkbox"
                    onChange={e => setSelectedIds(e.target.checked ? filteredRules.map((r: any) => r.id) : [])} />
                </th>
                <th className="w-16">Status</th>
                <th>Interface</th>
                <th>Internal Prefix (ULA)</th>
                <th>External Prefix (GUA)</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="text-center py-8 text-[#999] text-[11px]">Loading…</td></tr>
              )}
              {!isLoading && filteredRules.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-[#999]">
                  <Network className="w-10 h-10 mx-auto mb-2 opacity-25" />
                  <div className="text-[12px] mb-1">No NPt rules</div>
                  <div className="text-[10px] mb-3">Network Prefix Translation rewrites IPv6 prefix pairs without state</div>
                  <button className="forti-toolbar-btn primary" onClick={() => openCreate('npt')}>
                    <Plus className="w-3 h-3 inline mr-1" /> Add NPt Rule
                  </button>
                </td></tr>
              )}
              {filteredRules.map((rule: any) => (
                <tr
                  key={rule.id}
                  data-testid={`row-nat-npt-${rule.id}`}
                  className={cn(!rule.enabled && "opacity-60", selectedIds.includes(rule.id) && "selected")}
                  onClick={() => setSelectedIds(prev =>
                    prev.includes(rule.id) ? prev.filter(i => i !== rule.id) : [...prev, rule.id])}
                >
                  <td><SelectionCheckbox id={rule.id} /></td>
                  <RowToggle rule={rule} />
                  <td><IfaceBadge iface={rule.interface} /></td>
                  <td className="font-mono text-[11px]">{rule.internal_address || '—'}</td>
                  <td className="font-mono text-[11px]">{rule.external_address || '—'}</td>
                  <td className="text-[11px]">{rule.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* Create / Edit Modal                                            */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4" />
              {editingRule ? 'Edit NAT Rule' : 'New NAT Rule'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-[11px]">
            {/* Rule type + Interface */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1 text-[#555]">Rule Type</label>
                <select
                  data-testid="select-nat-type"
                  className="forti-select w-full"
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                >
                  <option value="port-forward">Port Forward (DNAT)</option>
                  <option value="outbound">Outbound NAT (SNAT/MASQUERADE)</option>
                  <option value="1:1">1:1 NAT (Static)</option>
                  <option value="npt">NPt (IPv6 Prefix)</option>
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1 text-[#555]">Interface</label>
                <select
                  data-testid="select-nat-iface"
                  className="forti-select w-full"
                  value={form.interface}
                  onChange={e => setForm(f => ({ ...f, interface: e.target.value }))}
                >
                  {INTERFACES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
            </div>

            {/* Protocol — only for port-forward */}
            {form.type === 'port-forward' && (
              <div>
                <label className="block font-medium mb-1 text-[#555]">Protocol</label>
                <div className="flex gap-2">
                  {PROTOCOLS.map(p => (
                    <button
                      key={p} type="button"
                      onClick={() => setForm(f => ({ ...f, protocol: p }))}
                      className={cn(
                        "px-3 py-1.5 rounded border text-[11px] transition-colors",
                        form.protocol === p
                          ? "border-[hsl(142,70%,35%)] bg-[hsl(142,70%,35%)]/10 text-[hsl(142,70%,35%)]"
                          : "border-[#ccc] hover:bg-[#f0f0f0]"
                      )}
                    >
                      {p.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Address fields (context-sensitive labels) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1 text-[#555]">
                  {form.type === '1:1'   ? 'External IP (Public)'    :
                   form.type === 'npt'   ? 'Internal Prefix (ULA)'   :
                   form.type === 'outbound' ? 'NAT Address (optional)' :
                   'External Address (optional)'}
                  {(form.type === '1:1' || form.type === 'npt') && <span className="text-red-500 ml-1">*</span>}
                </label>
                <input
                  data-testid="input-nat-ext-addr"
                  className="forti-input w-full"
                  placeholder={
                    form.type === '1:1'    ? '203.0.113.10'       :
                    form.type === 'npt'    ? 'fd00::/64'           :
                    form.type === 'outbound' ? 'leave blank = MASQUERADE' :
                    'any'
                  }
                  value={form.external_address}
                  onChange={e => setForm(f => ({ ...f, external_address: e.target.value }))}
                />
              </div>
              {(form.type === 'port-forward') && (
                <div>
                  <label className="block font-medium mb-1 text-[#555]">
                    External Port <span className="text-red-500">*</span>
                  </label>
                  <input
                    data-testid="input-nat-ext-port"
                    className="forti-input w-full"
                    placeholder="80"
                    value={form.external_port}
                    onChange={e => setForm(f => ({ ...f, external_port: e.target.value }))}
                  />
                </div>
              )}
              {form.type === 'npt' && (
                <div>
                  <label className="block font-medium mb-1 text-[#555]">
                    External Prefix (GUA) <span className="text-red-500">*</span>
                  </label>
                  <input
                    data-testid="input-nat-ext-pfx"
                    className="forti-input w-full"
                    placeholder="2001:db8::/64"
                    value={form.external_port}
                    onChange={e => setForm(f => ({ ...f, external_port: e.target.value }))}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1 text-[#555]">
                  {form.type === '1:1'    ? 'Internal IP (Private)'  :
                   form.type === 'npt'    ? 'External Prefix (GUA)'  :
                   form.type === 'outbound' ? 'Source Network'        :
                   'Internal Address'}
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  data-testid="input-nat-int-addr"
                  className="forti-input w-full"
                  placeholder={
                    form.type === '1:1'     ? '192.168.1.100'     :
                    form.type === 'npt'     ? '2001:db8::/64'     :
                    form.type === 'outbound' ? '192.168.1.0/24'   :
                    '192.168.1.100'
                  }
                  value={form.internal_address}
                  onChange={e => setForm(f => ({ ...f, internal_address: e.target.value }))}
                />
              </div>
              {form.type === 'port-forward' && (
                <div>
                  <label className="block font-medium mb-1 text-[#555]">
                    Internal Port <span className="text-red-500">*</span>
                  </label>
                  <input
                    data-testid="input-nat-int-port"
                    className="forti-input w-full"
                    placeholder="80"
                    value={form.internal_port}
                    onChange={e => setForm(f => ({ ...f, internal_port: e.target.value }))}
                  />
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block font-medium mb-1 text-[#555]">Description</label>
              <input
                data-testid="input-nat-desc"
                className="forti-input w-full"
                placeholder="Optional description…"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            {/* Enabled toggle */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="nat-enabled"
                checked={form.enabled}
                onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
              />
              <label htmlFor="nat-enabled" className="cursor-pointer text-[#555]">Enabled</label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#e0e0e0]">
              <button className="forti-toolbar-btn" onClick={() => setModalOpen(false)}>Cancel</button>
              <button
                data-testid="button-nat-submit"
                className="forti-toolbar-btn primary"
                onClick={handleSubmit}
                disabled={createMut.isPending || updateMut.isPending}
              >
                {(createMut.isPending || updateMut.isPending) ? 'Saving…' : 'OK'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Shell>
  );
};

export default NATConfig;
