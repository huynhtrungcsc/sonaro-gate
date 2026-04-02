import { useState } from 'react';
import { useIDSSignatures } from '@/hooks/useDbData';
import { idsSignaturesApi } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shell } from '@/components/layout/Shell';
import { cn } from '@/lib/utils';
import { FortiToggle } from '@/components/ui/forti-toggle';
import { toast } from 'sonner';

async function apiPost(url: string, body?: object) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  return r.json();
}

interface IPSSignature {
  id: string;
  name: string;
  exemptIps: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  target: string;
  service: string;
  os: string;
  action: 'block' | 'monitor' | 'pass' | 'reset';
}

interface IPSFilter {
  id: string;
  filterDetails: string;
  action: 'block' | 'monitor' | 'pass';
  packetLogging: boolean;
}

const SeverityBars = ({ level }: { level: IPSSignature['severity'] }) => {
  const filled = { critical: 5, high: 4, medium: 3, low: 2, info: 1 }[level];
  const colors: Record<string, string> = {
    critical: '#c00',
    high: '#e65100',
    medium: '#f57f17',
    low: '#1565c0',
    info: '#777',
  };
  return (
    <span style={{ color: colors[level], fontFamily: 'monospace', fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>
      {'■'.repeat(filled)}{'□'.repeat(5 - filled)}
    </span>
  );
};

const IDSSettings = () => {
  const [blockMaliciousUrls, setBlockMaliciousUrls] = useState(true);
  const [sensorName] = useState('default');
  const [sensorComments, setSensorComments] = useState('Prevent critical attacks.');
  const [botnetMode, setBotnetMode] = useState<'disable' | 'block' | 'monitor'>('block');
  const queryClient = useQueryClient();
  const { data: signatures = [] } = useIDSSignatures();
  const updateSigMut = useMutation({ mutationFn: ({ id, d }: { id: string; d: any }) => idsSignaturesApi.update(id, d), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ids-signatures'] }), onError: () => toast.error('Failed to update signature') });
  const [filters] = useState<IPSFilter[]>([]);
  const [selectedSigs, setSelectedSigs] = useState<string[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState(false);
  const [showAddSig, setShowAddSig] = useState(false);
  const [newSig, setNewSig] = useState({ message: '', category: 'policy-violation', severity: 'medium', action: 'alert', protocol: 'tcp', srcIp: 'any', srcPort: 'any', dstIp: 'any', dstPort: 'any' });

  const { data: ipsStatus } = useQuery<{ installed: boolean; running: boolean; version: string | null; ruleCount: number }>({
    queryKey: ['/api/system/ips/status'],
    refetchInterval: 30_000,
  });

  const handleUpdateSignatures = async () => {
    setUpdating(true);
    const result = await apiPost('/api/system/ips/update-signatures');
    setUpdating(false);
    if (result.ok) {
      toast.success(result.message || 'Signatures updated successfully');
    } else {
      toast.error(result.message || 'Update failed — ensure suricata-update is installed');
      if (result.output) console.info('[Suricata update output]', result.output);
    }
  };

  const handleAddSignature = async () => {
    if (!newSig.message.trim()) { toast.error('Message is required'); return; }
    const sid = Date.now() % 1_000_000 + 9_000_000;
    const result = await apiPost('/api/system/ips/rules', { ...newSig, sid });
    if (result.ok) {
      toast.success('Rule added and Suricata reloaded');
      setShowAddSig(false);
      setNewSig({ message: '', category: 'policy-violation', severity: 'medium', action: 'alert', protocol: 'tcp', srcIp: 'any', srcPort: 'any', dstIp: 'any', dstPort: 'any' });
    } else {
      toast.error(result.message || 'Failed to add rule');
    }
  };

  const handleToggleService = async () => {
    if (!ipsStatus?.installed) { toast.error('Suricata not installed on this host'); return; }
    const url = ipsStatus.running ? '/api/system/ips/stop' : '/api/system/ips/start';
    const result = await apiPost(url);
    toast[result.ok ? 'success' : 'error'](result.message);
    queryClient.invalidateQueries({ queryKey: ['/api/system/ips/status'] });
  };

  const toggleSig = (id: string) => {
    setSelectedSigs(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const toggleFilter = (id: string) => {
    setSelectedFilters(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const filteredSigs = signatures.filter(s =>
    search === '' || s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Shell>
      <div className="space-y-0">

        {/* Suricata Engine Status */}
        <div className="forti-toolbar" style={{ background: '#f5f6f8', borderBottom: '1px solid #e0e0e0', gap: 20 }}>
          <span className="text-[11px] font-semibold text-[#444]" style={{ letterSpacing: 1 }}>IPS ENGINE</span>
          <span className="flex items-center gap-1.5 text-[11px]">
            <span className={cn('inline-block w-1.5 h-1.5 rounded-full', ipsStatus?.installed ? (ipsStatus.running ? 'bg-green-500' : 'bg-amber-400') : 'bg-[#bbb]')} />
            {ipsStatus == null ? <span className="text-[#999]">Checking…</span>
              : !ipsStatus.installed ? <span className="text-[#c00]">Suricata not installed</span>
              : ipsStatus.running ? <span className="text-green-700">Running</span>
              : <span className="text-amber-700">Stopped</span>}
          </span>
          {ipsStatus?.version && (
            <span className="text-[10px] text-[#999]">{ipsStatus.version.split('\n')[0]}</span>
          )}
          {ipsStatus?.ruleCount != null && (
            <span className="text-[10px] text-[#999]">{ipsStatus.ruleCount} local rule{ipsStatus.ruleCount !== 1 ? 's' : ''}</span>
          )}
          <div className="flex-1" />
          {ipsStatus?.installed && (
            <button
              className={cn('forti-toolbar-btn', ipsStatus.running ? '' : 'primary')}
              onClick={handleToggleService}
            >
              {ipsStatus.running ? '■ Stop Engine' : '▶ Start Engine'}
            </button>
          )}
          {!ipsStatus?.installed && (
            <span className="text-[10px] text-amber-700 font-medium">Install: apt-get install suricata suricata-update</span>
          )}
        </div>

        {/* Add Signature Modal */}
        {showAddSig && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', border: '1px solid #ccc', borderRadius: 4, minWidth: 480, boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}>
              <div style={{ background: '#e8ecf0', borderBottom: '1px solid #ccc', padding: '8px 16px', fontWeight: 700, fontSize: 12, letterSpacing: 0.5 }}>Add Custom IPS Rule</div>
              <div style={{ padding: '16px', display: 'grid', gap: 8 }}>
                <div className="flex items-center gap-3 text-[12px]">
                  <span className="forti-label w-32">Message *</span>
                  <input className="forti-input flex-1" placeholder="e.g. Suspicious outbound TCP" value={newSig.message} onChange={e => setNewSig(s => ({ ...s, message: e.target.value }))} />
                </div>
                <div className="flex items-center gap-3 text-[12px]">
                  <span className="forti-label w-32">Action</span>
                  <select className="forti-select" value={newSig.action} onChange={e => setNewSig(s => ({ ...s, action: e.target.value }))}>
                    {['alert','drop','reject','pass'].map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <span className="forti-label w-20">Protocol</span>
                  <select className="forti-select" value={newSig.protocol} onChange={e => setNewSig(s => ({ ...s, protocol: e.target.value }))}>
                    {['tcp','udp','icmp','any'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-3 text-[12px]">
                  <span className="forti-label w-32">Severity</span>
                  <select className="forti-select" value={newSig.severity} onChange={e => setNewSig(s => ({ ...s, severity: e.target.value }))}>
                    {['critical','high','medium','low','info'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span className="forti-label w-20">Category</span>
                  <input className="forti-input flex-1" value={newSig.category} onChange={e => setNewSig(s => ({ ...s, category: e.target.value }))} />
                </div>
                <div className="flex items-center gap-3 text-[12px]">
                  <span className="forti-label w-32">Source IP</span>
                  <input className="forti-input w-28" value={newSig.srcIp} onChange={e => setNewSig(s => ({ ...s, srcIp: e.target.value }))} />
                  <span className="forti-label">Port</span>
                  <input className="forti-input w-20" value={newSig.srcPort} onChange={e => setNewSig(s => ({ ...s, srcPort: e.target.value }))} />
                </div>
                <div className="flex items-center gap-3 text-[12px]">
                  <span className="forti-label w-32">Dest IP</span>
                  <input className="forti-input w-28" value={newSig.dstIp} onChange={e => setNewSig(s => ({ ...s, dstIp: e.target.value }))} />
                  <span className="forti-label">Port</span>
                  <input className="forti-input w-20" value={newSig.dstPort} onChange={e => setNewSig(s => ({ ...s, dstPort: e.target.value }))} />
                </div>
                <div style={{ background: '#f5f6f8', border: '1px solid #e0e0e0', borderRadius: 2, padding: '6px 10px', fontSize: 10, fontFamily: 'monospace', color: '#555', marginTop: 4 }}>
                  Preview: {newSig.action} {newSig.protocol} {newSig.srcIp} {newSig.srcPort} → {newSig.dstIp} {newSig.dstPort} (msg:"{newSig.message}"; classtype:{newSig.category};)
                </div>
              </div>
              <div style={{ borderTop: '1px solid #e0e0e0', padding: '8px 16px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="forti-toolbar-btn" onClick={() => setShowAddSig(false)}>Cancel</button>
                <button className="forti-toolbar-btn primary" onClick={handleAddSignature}>Add Rule</button>
              </div>
            </div>
          </div>
        )}

        {/* Main Toolbar */}
        <div className="forti-toolbar">
          <button className="forti-toolbar-btn primary" onClick={() => toast.info('Create new IPS sensor')}>
            + Create New
          </button>
          <button className="forti-toolbar-btn" onClick={() => toast.info('Edit sensor')}>
            ✏ Edit
          </button>
          <button className="forti-toolbar-btn" onClick={() => toast.info('Delete sensor')}>
            🗑 Delete
          </button>
          <div className="forti-toolbar-separator" />
          <button
            className="forti-toolbar-btn"
            onClick={handleUpdateSignatures}
            disabled={updating}
          >
            {updating ? 'Updating...' : '↻ Update Signatures'}
          </button>
          <div className="flex-1" />
          <div className="forti-search">
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Sensor Form */}
        <div className="section">
          <div className="section-header">Edit IPS Sensor</div>
          <div className="px-4 py-2">
            <table className="text-[12px]" style={{ borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td className="forti-label py-2 pr-6 w-48">Name</td>
                  <td className="py-2">
                    <input className="forti-input w-56" value={sensorName} readOnly />
                  </td>
                </tr>
                <tr>
                  <td className="forti-label py-2 pr-6">Comments</td>
                  <td className="py-2">
                    <textarea
                      className="forti-input w-56 h-14 resize-none"
                      value={sensorComments}
                      onChange={(e) => setSensorComments(e.target.value)}
                      maxLength={255}
                    />
                    <span className="text-[10px] text-[#999] ml-2">{sensorComments.length}/255</span>
                  </td>
                </tr>
                <tr>
                  <td className="forti-label py-2 pr-6">Block malicious URLs</td>
                  <td className="py-2">
                    <FortiToggle
                      enabled={blockMaliciousUrls}
                      onToggle={() => setBlockMaliciousUrls(v => !v)}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* IPS Signatures */}
        <div className="section">
          <div className="section-header">IPS Signatures</div>
          <div className="forti-toolbar" style={{ borderTop: '1px solid #e0e0e0', background: '#fafafa' }}>
            <button className="forti-toolbar-btn primary" onClick={() => setShowAddSig(true)}>
              + Add Custom Rule
            </button>
            <button
              className="forti-toolbar-btn"
              disabled={selectedSigs.length === 0}
              onClick={() => {
                selectedSigs.forEach(id => idsSignaturesApi.update(id, { enabled: false }));
                queryClient.invalidateQueries({ queryKey: ['ids-signatures'] });
                toast.success(`${selectedSigs.length} signature(s) removed from sensor`);
                setSelectedSigs([]);
              }}
            >
              🗑 Delete
            </button>
            <button
              className="forti-toolbar-btn"
              disabled={selectedSigs.length !== 1}
              onClick={() => toast.info('Edit IP exemptions for selected signature')}
            >
              ✏ Edit IP Exemptions
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Exempt IPs</th>
                <th>Severity</th>
                <th>Target</th>
                <th>Service</th>
                <th>OS</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredSigs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-[#999] py-4">
                    No matching entries found
                  </td>
                </tr>
              ) : filteredSigs.map(sig => (
                <tr
                  key={sig.id}
                  className={cn(selectedSigs.includes(sig.id) && 'data-table-row-selected')}
                  onClick={() => toggleSig(sig.id)}
                >
                  <td className="font-medium text-[#333]">{sig.name}</td>
                  <td className="text-[#666]">{sig.exemptIps || '—'}</td>
                  <td><SeverityBars level={sig.severity} /></td>
                  <td>{sig.target}</td>
                  <td>{sig.service}</td>
                  <td>{sig.os}</td>
                  <td>{sig.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* IPS Filters */}
        <div className="section">
          <div className="section-header">IPS Filters</div>
          <div className="forti-toolbar" style={{ borderTop: '1px solid #e0e0e0', background: '#fafafa' }}>
            <button className="forti-toolbar-btn primary" onClick={() => toast.info('Add IPS filter')}>
              + Add Filter
            </button>
            <button
              className="forti-toolbar-btn"
              disabled={selectedFilters.length !== 1}
              onClick={() => toast.info('Edit selected filter')}
            >
              ✏ Edit Filter
            </button>
            <button
              className="forti-toolbar-btn"
              disabled={selectedFilters.length === 0}
              onClick={() => toast.info('Delete selected filter')}
            >
              🗑 Delete
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Filter Details</th>
                <th>Action</th>
                <th>Packet Logging</th>
              </tr>
            </thead>
            <tbody>
              {filters.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center text-[#999] py-4">
                    No matching entries found
                  </td>
                </tr>
              ) : filters.map(f => (
                <tr
                  key={f.id}
                  className={cn(selectedFilters.includes(f.id) && 'data-table-row-selected')}
                  onClick={() => toggleFilter(f.id)}
                >
                  <td>{f.filterDetails}</td>
                  <td>{f.action}</td>
                  <td>{f.packetLogging ? 'Enable' : 'Disable'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Botnet C&C */}
        <div className="section">
          <div className="section-header">Botnet C&C</div>
          <div className="px-4 py-3">
            <table className="text-[12px]" style={{ borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td className="forti-label py-2 pr-8 w-80">Scan Outgoing Connections to Botnet Sites</td>
                  <td className="py-2">
                    <div className="flex items-center">
                      {(['disable', 'block', 'monitor'] as const).map((mode, i) => (
                        <button
                          key={mode}
                          onClick={() => setBotnetMode(mode)}
                          style={{
                            marginLeft: i === 0 ? 0 : -1,
                            borderRadius: i === 0 ? '2px 0 0 2px' : i === 2 ? '0 2px 2px 0' : 0,
                            position: 'relative',
                            zIndex: botnetMode === mode ? 1 : 0,
                          }}
                          className={cn(
                            'px-4 py-1 text-[11px] border border-[#bbb] cursor-pointer',
                            botnetMode === mode
                              ? 'bg-[#4caf50] text-white border-[#4caf50]'
                              : 'bg-white text-[#444] hover:bg-[#f5f5f5]'
                          )}
                        >
                          {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Apply Footer */}
        <div className="flex justify-end px-4 py-3 bg-white border border-[#ddd]">
          <button
            className="forti-toolbar-btn primary px-8"
            onClick={() => toast.success('IPS sensor configuration saved')}
          >
            Apply
          </button>
        </div>
      </div>
    </Shell>
  );
};

export default IDSSettings;
