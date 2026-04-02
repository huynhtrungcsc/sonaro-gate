import { useState } from 'react';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { FortiToggle } from '@/components/ui/forti-toggle';
import { ChevronDown, Plus, Edit2, Trash2, RefreshCw, Search, ArrowRightLeft, Globe, Network } from 'lucide-react';
import { toast } from 'sonner';
import { useNATRules } from '@/hooks/useDbData';
import { natRulesApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const NATConfig = () => {
  const [activeTab, setActiveTab] = useState<'port-forward' | 'outbound' | '1:1' | 'npt'>('port-forward');
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const queryClient = useQueryClient();
  const { data: rules = [], isLoading } = useNATRules();

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      natRulesApi.update(id, { enabled } as any),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nat-rules'] }),
    onError: () => toast.error('Failed to update rule'),
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

  const tabs = [
    { id: 'port-forward', label: 'Port Forward', count: rules.filter((r: any) => r.type === 'port-forward').length, icon: ArrowRightLeft },
    { id: 'outbound', label: 'Outbound NAT', count: rules.filter((r: any) => r.type === 'outbound').length, icon: Globe },
    { id: '1:1', label: '1:1 NAT', count: rules.filter((r: any) => r.type === '1:1').length, icon: Network },
    { id: 'npt', label: 'NPt (IPv6)', count: rules.filter((r: any) => r.type === 'npt').length, icon: Network },
  ];

  const filteredRules = rules.filter((r: any) => {
    const matchesType = r.type === activeTab;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || (r.description ?? '').toLowerCase().includes(q) ||
      (r.internal_address ?? '').includes(q) || (r.external_port ?? '').includes(q);
    return matchesType && matchesSearch;
  });

  const toggleRule = (id: string, current: boolean) => {
    toggleMut.mutate({ id, enabled: !current });
  };

  return (
    <Shell>
      <div className="space-y-0 animate-slide-in">
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
                {[
                  { label: 'Port Forward Rule', icon: ArrowRightLeft, type: 'port-forward' },
                  { label: 'Outbound NAT Rule', icon: Globe, type: 'outbound' },
                  { label: '1:1 NAT Mapping', icon: Network, type: '1:1' },
                  { label: 'NPt Rule', icon: Network, type: 'npt' },
                ].map(item => (
                  <button
                    key={item.type}
                    className="w-full px-3 py-2 text-left text-[11px] hover:bg-[#f0f0f0] flex items-center gap-2"
                    onClick={() => {
                      setShowCreateMenu(false);
                      toast.info(`NAT rule editor not yet implemented`);
                    }}
                  >
                    <item.icon className="w-3 h-3" />
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            className="forti-toolbar-btn"
            disabled={selectedIds.length !== 1}
            onClick={() => toast.info('Rule editor not yet implemented')}
          >
            <Edit2 className="w-3 h-3" />
            Edit
          </button>
          <button
            className="forti-toolbar-btn"
            disabled={selectedIds.length === 0}
            onClick={() => {
              selectedIds.forEach(id => deleteMut.mutate(id));
            }}
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
          <div className="forti-toolbar-separator" />
          <button
            className="forti-toolbar-btn"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['nat-rules'] })}
          >
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

        <div className="flex items-center bg-[#e8e8e8] border-b border-[#ccc]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
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
                activeTab === tab.id ? "bg-[hsl(142,70%,35%)]/20 text-[hsl(142,70%,35%)]" : "bg-[#ddd] text-[#666]"
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {activeTab === 'port-forward' && (
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-8">
                  <input
                    type="checkbox"
                    className="forti-checkbox"
                    onChange={e => setSelectedIds(e.target.checked ? filteredRules.map((r: any) => r.id) : [])}
                  />
                </th>
                <th className="w-16">Status</th>
                <th>Interface</th>
                <th>Protocol</th>
                <th>External Port</th>
                <th>Internal Address</th>
                <th>Internal Port</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="text-center py-8 text-[#999] text-[11px]">Loading…</td></tr>
              )}
              {!isLoading && filteredRules.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-[#999] text-[11px]">No port forward rules configured</td></tr>
              )}
              {filteredRules.map((rule: any) => (
                <tr
                  key={rule.id}
                  className={cn(!rule.enabled && "opacity-60", selectedIds.includes(rule.id) && "selected")}
                  onClick={() => setSelectedIds(prev =>
                    prev.includes(rule.id) ? prev.filter(i => i !== rule.id) : [...prev, rule.id]
                  )}
                >
                  <td onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="forti-checkbox"
                      checked={selectedIds.includes(rule.id)}
                      onChange={() => setSelectedIds(prev =>
                        prev.includes(rule.id) ? prev.filter(i => i !== rule.id) : [...prev, rule.id]
                      )}
                    />
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <FortiToggle
                      enabled={rule.enabled}
                      onToggle={() => toggleRule(rule.id, rule.enabled)}
                      size="sm"
                    />
                  </td>
                  <td>
                    <span className="forti-tag bg-blue-100 text-blue-700 border-blue-200">
                      {rule.interface}
                    </span>
                  </td>
                  <td className="font-mono text-[11px]">{rule.protocol?.toUpperCase()}</td>
                  <td className="font-mono text-[11px]">{rule.external_port}</td>
                  <td className="font-mono text-[11px]">{rule.internal_address}</td>
                  <td className="font-mono text-[11px]">{rule.internal_port}</td>
                  <td className="text-[11px]">{rule.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'outbound' && (
          <div className="p-4 space-y-4">
            <div className="section">
              <div className="section-header-neutral">
                <span>Outbound NAT Mode</span>
              </div>
              <div className="section-body">
                <div className="grid grid-cols-3 gap-4">
                  {['Automatic', 'Hybrid', 'Manual'].map((mode) => (
                    <label key={mode} className="flex items-start gap-3 p-4 bg-[#f8f8f8] border border-[#ddd] cursor-pointer hover:border-[hsl(142,70%,35%)] transition-colors">
                      <input type="radio" name="nat-mode" defaultChecked={mode === 'Automatic'} className="mt-0.5" />
                      <div>
                        <div className="font-medium text-[11px]">{mode} Outbound NAT</div>
                        <div className="text-[10px] text-[#666] mt-1">
                          {mode === 'Automatic' && 'System automatically creates outbound NAT rules'}
                          {mode === 'Hybrid' && 'Automatic rules plus manual mappings'}
                          {mode === 'Manual' && 'Full manual control over outbound NAT'}
                        </div>
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
                  <th>Source</th>
                  <th>Source Port</th>
                  <th>Destination</th>
                  <th>NAT Address</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {rules.filter((r: any) => r.type === 'outbound').length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-[#999] text-[11px]">No outbound NAT rules configured</td></tr>
                )}
                {rules.filter((r: any) => r.type === 'outbound').map((rule: any) => (
                  <tr key={rule.id}>
                    <td><input type="checkbox" className="forti-checkbox" /></td>
                    <td>
                      <FortiToggle enabled={rule.enabled} onToggle={() => toggleRule(rule.id, rule.enabled)} size="sm" />
                    </td>
                    <td>
                      <span className="forti-tag bg-blue-100 text-blue-700 border-blue-200">{rule.interface}</span>
                    </td>
                    <td className="font-mono text-[10px]">{rule.internal_address}</td>
                    <td className="font-mono text-[10px]">*</td>
                    <td className="font-mono text-[10px]">*</td>
                    <td className="font-mono text-[10px]">{rule.external_address}</td>
                    <td className="text-[11px]">{rule.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(activeTab === '1:1' || activeTab === 'npt') && (
          <div className="p-4">
            <div className="section">
              <div className="section-body">
                <div className="flex flex-col items-center justify-center py-12 text-[#666]">
                  <Network className="w-12 h-12 mb-3 opacity-30" />
                  <div className="text-[13px] mb-2">
                    No {activeTab === '1:1' ? '1:1 NAT' : 'NPt'} rules configured
                  </div>
                  <div className="text-[11px] text-[#999] mb-4">
                    {activeTab === '1:1' ? '1:1 NAT maps an external IP to an internal IP' : 'Network Prefix Translation for IPv6'}
                  </div>
                  <button className="forti-toolbar-btn primary" onClick={() => toast.info('Rule editor not yet implemented')}>
                    <Plus className="w-3 h-3 inline mr-1" />
                    Add {activeTab === '1:1' ? '1:1 NAT' : 'NPt'} Rule
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
};

export default NATConfig;
