import { Shell } from '@/components/layout/Shell';
import { useState, useEffect } from 'react';
import { FortiToggle } from '@/components/ui/forti-toggle';
import { toast } from 'sonner';
import { useSystemSettings } from '@/hooks/useDbData';
import { systemSettingsApi } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

interface OSPFArea {
  id: string;
  areaId: string;
  type: 'regular' | 'stub' | 'nssa';
  networks: string[];
}

interface OSPFInterface {
  name: string;
  area: string;
  cost: number;
  priority: number;
  helloInterval: number;
  deadInterval: number;
  authentication: 'none' | 'text' | 'md5';
}

const OSPFConfig = () => {
  const queryClient = useQueryClient();
  const { data: dbSettings = [] } = useSystemSettings();
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [routerId, setRouterId] = useState('');
  const [abrType, setAbrType] = useState('Cisco');
  const [defaultMetric, setDefaultMetric] = useState(10);
  const [refBandwidth, setRefBandwidth] = useState(100);
  const [areas, setAreas] = useState<OSPFArea[]>([]);
  const [interfaces, setInterfaces] = useState<OSPFInterface[]>([]);

  useEffect(() => {
    if (loaded || !(dbSettings as any[]).length) return;
    const get = (key: string) => (dbSettings as any[]).find((s: any) => s.key === key)?.value;
    const cfg = get('ospf_config');
    if (cfg) {
      try {
        const p = JSON.parse(cfg);
        if (p.enabled !== undefined) setEnabled(p.enabled);
        if (p.routerId !== undefined) setRouterId(p.routerId);
        if (p.abrType) setAbrType(p.abrType);
        if (p.defaultMetric !== undefined) setDefaultMetric(p.defaultMetric);
        if (p.refBandwidth !== undefined) setRefBandwidth(p.refBandwidth);
        if (Array.isArray(p.areas)) setAreas(p.areas);
        if (Array.isArray(p.interfaces)) setInterfaces(p.interfaces);
      } catch {}
    }
    setLoaded(true);
  }, [dbSettings, loaded]);

  const handleApply = async () => {
    try {
      await systemSettingsApi.upsert('ospf_config', JSON.stringify({ enabled, routerId, abrType, defaultMetric, refBandwidth, areas, interfaces }));
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      toast.success('OSPF configuration saved');
    } catch { toast.error('Failed to save OSPF configuration'); }
  };

  const handleRefresh = () => {
    setLoaded(false);
    queryClient.invalidateQueries({ queryKey: ['system-settings'] });
  };

  return (
    <Shell>
      <div className="space-y-0">
        <div className="forti-toolbar">
          <button className="forti-toolbar-btn primary" disabled={!enabled} onClick={() => toast.info('Add OSPF area via the API or CLI')}>+ Create New</button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={handleApply}>Apply</button>
          <button className="forti-toolbar-btn" onClick={handleRefresh}>Refresh</button>
        </div>

        <div className="grid grid-cols-3 gap-4 p-3">
          <div className="col-span-1 section">
            <div className="section-header">Basic Settings</div>
            <div className="section-body space-y-2">
              <div className="flex items-center justify-between py-0.5">
                <span className="forti-label-inline">Enable OSPF</span>
                <FortiToggle enabled={enabled} onToggle={() => setEnabled(v => !v)} />
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="forti-label-inline">Router ID</span>
                <input
                  type="text"
                  value={routerId}
                  onChange={e => setRouterId(e.target.value)}
                  placeholder="e.g. 10.0.0.1"
                  className="forti-input w-28 font-mono"
                  disabled={!enabled}
                />
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="forti-label-inline">ABR Type</span>
                <select
                  value={abrType}
                  onChange={e => setAbrType(e.target.value)}
                  className="forti-select"
                  disabled={!enabled}
                >
                  <option>Cisco</option>
                  <option>IBM</option>
                  <option>Standard</option>
                </select>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="forti-label-inline">Default Metric</span>
                <input
                  type="number"
                  value={defaultMetric}
                  onChange={e => setDefaultMetric(Number(e.target.value))}
                  className="forti-input w-20"
                  disabled={!enabled}
                />
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="forti-label-inline">Reference Bandwidth</span>
                <input
                  type="number"
                  value={refBandwidth}
                  onChange={e => setRefBandwidth(Number(e.target.value))}
                  className="forti-input w-20"
                  disabled={!enabled}
                />
              </div>
            </div>
          </div>

          <div className="col-span-2 space-y-3">
            <div className="section">
              <div className="section-header">OSPF Areas</div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Area ID</th>
                    <th>Type</th>
                    <th>Networks</th>
                  </tr>
                </thead>
                <tbody>
                  {areas.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-8 text-[#999]">No OSPF areas configured</td>
                    </tr>
                  ) : areas.map(area => (
                    <tr key={area.id}>
                      <td className="font-mono">{area.areaId}</td>
                      <td className="uppercase text-[10px] font-semibold">{area.type}</td>
                      <td className="font-mono text-[10px]">{area.networks.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="section">
              <div className="section-header">Interface Settings</div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Interface</th>
                    <th>Area</th>
                    <th>Cost</th>
                    <th>Priority</th>
                    <th>Hello (s)</th>
                    <th>Dead (s)</th>
                    <th>Auth</th>
                  </tr>
                </thead>
                <tbody>
                  {interfaces.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-[#999]">No OSPF interfaces configured</td>
                    </tr>
                  ) : interfaces.map(intf => (
                    <tr key={intf.name}>
                      <td className="font-medium">{intf.name}</td>
                      <td className="font-mono">{intf.area}</td>
                      <td>{intf.cost}</td>
                      <td>{intf.priority}</td>
                      <td>{intf.helloInterval}</td>
                      <td>{intf.deadInterval}</td>
                      <td>
                        <span className={`text-[10px] font-semibold ${intf.authentication === 'md5' ? 'text-green-700' : 'text-[#666]'}`}>
                          {intf.authentication.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
};

export default OSPFConfig;
