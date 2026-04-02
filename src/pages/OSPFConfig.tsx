import { Shell } from '@/components/layout/Shell';
import { useState } from 'react';
import { FortiToggle } from '@/components/ui/forti-toggle';

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
  const [enabled, setEnabled] = useState(false);
  const [routerId, setRouterId] = useState('10.0.0.1');
  const [areas] = useState<OSPFArea[]>([]);
  const [interfaces] = useState<OSPFInterface[]>([]);

  return (
    <Shell>
      <div className="space-y-0">
        <div className="forti-toolbar">
          <button className="forti-toolbar-btn primary" disabled={!enabled}>+ Create New</button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn">Apply</button>
          <button className="forti-toolbar-btn">Refresh</button>
        </div>

        <div className="grid grid-cols-3 gap-4 p-3">
          {/* Basic Settings */}
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
                  className="forti-input w-28 font-mono"
                  disabled={!enabled}
                />
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="forti-label-inline">ABR Type</span>
                <select className="forti-select" disabled={!enabled}>
                  <option>Cisco</option>
                  <option>IBM</option>
                  <option>Standard</option>
                </select>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="forti-label-inline">Default Metric</span>
                <input type="number" defaultValue={10} className="forti-input w-20" disabled={!enabled} />
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="forti-label-inline">Reference Bandwidth</span>
                <input type="number" defaultValue={100} className="forti-input w-20" disabled={!enabled} />
              </div>
            </div>
          </div>

          {/* Areas */}
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
