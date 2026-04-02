import { useState } from 'react';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/formatters';
import { FortiToggle } from '@/components/ui/forti-toggle';
import {
  Plus,
  Search,
  Shield,
  Check,
  X,
  Network,
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  Copy,
  RefreshCw
} from 'lucide-react';
import { FirewallRuleModal } from '@/components/firewall/FirewallRuleModal';
import type { FirewallRule } from '@/types/firewall';
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
import { useFirewallRules } from '@/hooks/useDbData';
import { firewallRulesApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface InterfacePair {
  from: string;
  to: string;
  rules: any[];
  expanded: boolean;
}

function dbToModalRule(r: any): FirewallRule {
  return {
    id: r.id,
    order: r.rule_order ?? 0,
    enabled: r.enabled,
    action: r.action === 'pass' || r.action === 'allow' ? 'pass' : 'block',
    interface: r.interface,
    direction: r.direction ?? 'in',
    protocol: r.protocol ?? 'any',
    source: {
      type: r.source_type ?? 'any',
      value: r.source_value ?? '*',
      port: r.source_port ?? '',
    },
    destination: {
      type: r.destination_type ?? 'any',
      value: r.destination_value ?? '*',
      port: r.destination_port ?? '',
    },
    description: r.description ?? '',
    logging: r.logging ?? false,
    hits: r.hits ?? 0,
    created: r.created_at ? new Date(r.created_at) : new Date(),
    schedule: '',
    nat: false,
  } as any;
}

function modalToDbRule(rule: Partial<FirewallRule>): Record<string, any> {
  return {
    enabled: rule.enabled ?? true,
    action: rule.action ?? 'block',
    interface: rule.interface ?? 'WAN',
    direction: (rule as any).direction ?? 'in',
    protocol: rule.protocol ?? 'any',
    source_type: rule.source?.type ?? 'any',
    source_value: rule.source?.value ?? '*',
    source_port: rule.source?.port ?? null,
    destination_type: rule.destination?.type ?? 'any',
    destination_value: rule.destination?.value ?? '*',
    destination_port: rule.destination?.port ?? null,
    description: rule.description ?? '',
    logging: rule.logging ?? false,
  };
}

interface SortableRowProps {
  rule: any;
  index: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onEdit: (rule: any) => void;
  onToggle: (id: string, enabled: boolean) => void;
  isDraggingDisabled: boolean;
}

function SortableRow({ rule, index, isSelected, onSelect, onEdit, onToggle, isDraggingDisabled }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rule.id, disabled: isDraggingDisabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        isDragging && "bg-yellow-50",
        isSelected && "selected",
        !rule.enabled && "opacity-60"
      )}
    >
      <td className="w-8 text-center">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(rule.id)}
          onClick={(e) => e.stopPropagation()}
          className="forti-checkbox"
        />
      </td>
      <td className="w-12 text-center">
        <FortiToggle
          enabled={rule.enabled}
          onToggle={() => onToggle(rule.id, rule.enabled)}
          size="sm"
        />
      </td>
      <td className="w-10 text-center text-[11px] text-[#333]">{index + 1}</td>
      <td className="text-[11px] font-medium text-[#111]" onDoubleClick={() => onEdit(rule)}>
        {rule.description || `Rule-${index + 1}`}
      </td>
      <td className="text-[11px] text-[#333]">
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 bg-[#4caf50] rounded-sm" />
          {rule.source_value === '*' ? 'all' : (rule.source_value ?? 'any')}
        </span>
      </td>
      <td className="text-[11px] text-[#333]">
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 bg-[#2196f3] rounded-sm" />
          {rule.destination_value === '*' ? 'all' : (rule.destination_value ?? 'any')}
        </span>
      </td>
      <td className="text-[11px] text-[#333]">always</td>
      <td className="text-[11px] text-[#333]">
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 bg-purple-400 rounded-sm text-white text-[8px] flex items-center justify-center">⚡</span>
          {rule.destination_port || 'ALL'}
        </span>
      </td>
      <td className="text-[11px]">
        <span className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 border text-[10px]",
          rule.action === 'pass' || rule.action === 'allow'
            ? 'bg-green-100 text-green-700 border-green-200'
            : 'bg-red-100 text-red-600 border-red-200'
        )}>
          {rule.action === 'pass' || rule.action === 'allow' ? <Check size={10} /> : <X size={10} />}
          {rule.action === 'pass' || rule.action === 'allow' ? 'ACCEPT' : 'DENY'}
        </span>
      </td>
      <td className="text-[11px]">
        <span className="inline-flex items-center gap-1 text-[#666]">
          <Shield size={10} />
          UTM
        </span>
      </td>
      <td className="text-[11px] text-right text-[#666]">{formatBytes((rule.hits ?? 0) * 1024)}</td>
    </tr>
  );
}

const FirewallRules = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'sequence' | 'interface'>('interface');
  const [expandedPairs, setExpandedPairs] = useState<string[]>([]);

  const queryClient = useQueryClient();
  const { data: rules = [], isLoading } = useFirewallRules();

  const createMut = useMutation({
    mutationFn: (data: any) => firewallRulesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firewall-rules'] });
      setModalOpen(false);
      toast.success('Rule created successfully');
    },
    onError: () => toast.error('Failed to create rule'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => firewallRulesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firewall-rules'] });
      setModalOpen(false);
      toast.success('Rule updated successfully');
    },
    onError: () => toast.error('Failed to update rule'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => firewallRulesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firewall-rules'] });
      setSelectedIds([]);
      toast.success('Rule deleted');
    },
    onError: () => toast.error('Failed to delete rule'),
  });

  const getInterfacePairs = (): InterfacePair[] => {
    const typedRules = rules as any[];
    if (typedRules.length === 0) return [];
    const pairMap = new Map<string, any[]>();
    typedRules.forEach(r => {
      const key = `${r.interface}→any`;
      if (!pairMap.has(key)) pairMap.set(key, []);
      pairMap.get(key)!.push(r);
    });
    return Array.from(pairMap.entries()).map(([key, pairRules]) => {
      const [from] = key.split('→');
      return { from, to: 'any', rules: pairRules, expanded: true };
    });
  };

  const interfacePairs = getInterfacePairs();
  const isDraggingDisabled = searchQuery !== '';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleToggleRule = (id: string, enabled: boolean) => {
    updateMut.mutate({ id, data: { enabled: !enabled } });
  };

  const handleAddRule = () => {
    setEditingRule(null);
    setModalOpen(true);
  };

  const handleEditRule = (rule: any) => {
    setEditingRule(rule);
    setModalOpen(true);
  };

  const handleSaveRule = (ruleData: Partial<FirewallRule>) => {
    const dbData = modalToDbRule(ruleData);
    if (editingRule) {
      updateMut.mutate({ id: editingRule.id, data: dbData });
    } else {
      createMut.mutate({ ...dbData, rule_order: (rules as any[]).length + 1 });
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    selectedIds.forEach(id => deleteMut.mutate(id));
    toast.success(`${selectedIds.length} rules deleted`);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      toast.success('Rule order updated (UI only — drag-to-persist coming soon)');
    }
  };

  const togglePair = (pairKey: string) => {
    setExpandedPairs(prev =>
      prev.includes(pairKey)
        ? prev.filter(p => p !== pairKey)
        : [...prev, pairKey]
    );
  };

  const filteredRules = (rules as any[]).filter(r => {
    const q = searchQuery.toLowerCase();
    return !q ||
      (r.description ?? '').toLowerCase().includes(q) ||
      (r.source_value ?? '').toLowerCase().includes(q) ||
      (r.destination_value ?? '').toLowerCase().includes(q) ||
      (r.interface ?? '').toLowerCase().includes(q);
  });

  const selectedRule = selectedIds.length === 1
    ? (rules as any[]).find(r => r.id === selectedIds[0])
    : null;

  const editingModalRule = editingRule ? dbToModalRule(editingRule) : null;

  return (
    <Shell>
      <div className="space-y-0 animate-slide-in">
        <div className="forti-toolbar">
          <button onClick={handleAddRule} className="forti-toolbar-btn primary">
            <Plus size={12} /> Create New
          </button>
          <button
            onClick={() => selectedRule && handleEditRule(selectedRule)}
            className="forti-toolbar-btn"
            disabled={selectedIds.length !== 1}
          >
            <Edit2 size={12} /> Edit
          </button>
          <button
            onClick={handleDeleteSelected}
            className="forti-toolbar-btn"
            disabled={selectedIds.length === 0}
          >
            <Trash2 size={12} /> Delete
          </button>
          <button
            className="forti-toolbar-btn"
            disabled={selectedIds.length !== 1}
            onClick={() => {
              const rule = (rules as any[]).find(r => r.id === selectedIds[0]);
              if (rule) {
                const { id, created_at, updated_at, ...rest } = rule;
                createMut.mutate({ ...rest, description: `${rule.description} (copy)` });
              }
            }}
          >
            <Copy size={12} /> Clone
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={() => toast.info('Policy Lookup: Enter source/destination to find matching policies')}>
            <Search size={12} /> Policy Lookup
          </button>
          <button className="forti-toolbar-btn" onClick={() => queryClient.invalidateQueries({ queryKey: ['firewall-rules'] })}>
            <RefreshCw size={12} /> Refresh
          </button>

          <div className="flex-1" />

          <div className="forti-search">
            <Search size={12} className="text-[#999]" />
            <input
              type="text"
              placeholder="Search rules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-40"
            />
          </div>

          <div className="forti-toolbar-separator" />

          <div className="flex items-center gap-0.5 bg-[#e0e0e0] p-0.5 rounded">
            {(['interface', 'sequence'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "px-2 py-0.5 text-[10px] font-medium rounded transition-colors",
                  viewMode === mode ? "bg-white text-[#333] shadow-sm" : "text-[#666]"
                )}
              >
                {mode === 'interface' ? 'Interface' : 'Sequence'}
              </button>
            ))}
          </div>
        </div>

        {viewMode === 'interface' ? (
          <div>
            {isLoading && (
              <div className="py-8 text-center text-[#999] text-[11px]">Loading…</div>
            )}
            {!isLoading && interfacePairs.length === 0 && (
              <div className="py-12 text-center">
                <Shield className="w-10 h-10 mx-auto mb-3 text-[#ccc]" />
                <div className="text-[11px] text-[#999]">No firewall rules configured</div>
                <button onClick={handleAddRule} className="forti-toolbar-btn primary mt-3">
                  <Plus size={12} /> Create First Rule
                </button>
              </div>
            )}
            {interfacePairs.map((pair) => {
              const pairKey = `${pair.from}→${pair.to}`;
              const isExpanded = !expandedPairs.includes(pairKey);

              return (
                <div key={pairKey} className="border-b border-[#ddd]">
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#f0f0f0] cursor-pointer hover:bg-[#e8e8e8] select-none"
                    onClick={() => togglePair(pairKey)}
                  >
                    {isExpanded ? <ChevronDown size={12} className="text-[#666]" /> : <ChevronRight size={12} className="text-[#666]" />}
                    <Network size={12} className="text-[#666]" />
                    <span className="text-[11px] font-medium text-[#333]">
                      {pair.from}
                    </span>
                    <span className="text-[10px] text-[#999]">→ any</span>
                    <span className="ml-auto text-[10px] text-[#888] bg-[#ddd] px-1.5 py-0.5 rounded">
                      {pair.rules.length} {pair.rules.length === 1 ? 'rule' : 'rules'}
                    </span>
                  </div>

                  {isExpanded && (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th className="w-8" />
                            <th className="w-12">Status</th>
                            <th className="w-10">#</th>
                            <th>Name</th>
                            <th>Source</th>
                            <th>Destination</th>
                            <th>Schedule</th>
                            <th>Service</th>
                            <th>Action</th>
                            <th>UTM</th>
                            <th className="text-right">Bytes</th>
                          </tr>
                        </thead>
                        <SortableContext
                          items={pair.rules.map(r => r.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <tbody>
                            {pair.rules.map((rule, index) => (
                              <SortableRow
                                key={rule.id}
                                rule={rule}
                                index={index}
                                isSelected={selectedIds.includes(rule.id)}
                                onSelect={handleSelect}
                                onEdit={handleEditRule}
                                onToggle={handleToggleRule}
                                isDraggingDisabled={isDraggingDisabled}
                              />
                            ))}
                          </tbody>
                        </SortableContext>
                      </table>
                    </DndContext>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-8" />
                  <th className="w-12">Status</th>
                  <th className="w-10">#</th>
                  <th>Name</th>
                  <th>Source</th>
                  <th>Destination</th>
                  <th>Schedule</th>
                  <th>Service</th>
                  <th>Action</th>
                  <th>UTM</th>
                  <th className="text-right">Bytes</th>
                </tr>
              </thead>
              <SortableContext items={filteredRules.map(r => r.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {isLoading && (
                    <tr><td colSpan={11} className="text-center py-8 text-[#999] text-[11px]">Loading…</td></tr>
                  )}
                  {!isLoading && filteredRules.length === 0 && (
                    <tr>
                      <td colSpan={11} className="text-center py-8 text-[#999] text-[11px]">
                        No firewall rules found
                      </td>
                    </tr>
                  )}
                  {filteredRules.map((rule, index) => (
                    <SortableRow
                      key={rule.id}
                      rule={rule}
                      index={index}
                      isSelected={selectedIds.includes(rule.id)}
                      onSelect={handleSelect}
                      onEdit={handleEditRule}
                      onToggle={handleToggleRule}
                      isDraggingDisabled={isDraggingDisabled}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
        )}

        <div className="flex items-center justify-between px-3 py-2 bg-[#f5f5f5] border border-t-0 border-[#ddd] text-[11px] text-[#333]">
          <span>Total: {(rules as any[]).length} rules</span>
          {selectedIds.length > 0 && (
            <span className="text-[hsl(142,70%,35%)]">{selectedIds.length} selected</span>
          )}
          <span>Showing {filteredRules.length} of {(rules as any[]).length}</span>
        </div>
      </div>

      <FirewallRuleModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        rule={editingModalRule}
        onSave={handleSaveRule}
      />
    </Shell>
  );
};

export default FirewallRules;
