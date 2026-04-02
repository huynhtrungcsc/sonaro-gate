import { Shell } from '@/components/layout/Shell';
import { useState } from 'react';
import { FortiToggle } from '@/components/ui/forti-toggle';

interface BGPNeighbor {
  id: string;
  ip: string;
  remoteAS: number;
  description: string;
  status: 'established' | 'active' | 'idle';
  uptime: string;
  prefixesReceived: number;
}

const STATUS_CLASS: Record<string, string> = {
  established: 'text-green-700',
  active: 'text-yellow-600',
  idle: 'text-red-600',
};

const BGPConfig = () => {
  const [enabled, setEnabled] = useState(false);
  const [localAS, setLocalAS] = useState(65001);
  const [routerId, setRouterId] = useState('10.0.0.1');
  const [keepalive, setKeepalive] = useState(60);
  const [holdTime, setHoldTime] = useState(180);
  const [neighbors] = useState<BGPNeighbor[]>([]);

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
          {/* Settings */}
          <div className="col-span-1 section">
            <div className="section-header">Basic Settings</div>
            <div className="section-body space-y-2">
              <div className="flex items-center justify-between py-0.5">
                <span className="forti-label-inline">Enable BGP</span>
                <FortiToggle enabled={enabled} onToggle={() => setEnabled(v => !v)} />
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="forti-label-inline">Local AS</span>
                <input
                  type="number"
                  value={localAS}
                  onChange={e => setLocalAS(parseInt(e.target.value))}
                  className="forti-input w-24 font-mono"
                  disabled={!enabled}
                />
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
                <span className="forti-label-inline">Keepalive (s)</span>
                <input
                  type="number"
                  value={keepalive}
                  onChange={e => setKeepalive(parseInt(e.target.value))}
                  className="forti-input w-20"
                  disabled={!enabled}
                />
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="forti-label-inline">Hold Time (s)</span>
                <input
                  type="number"
                  value={holdTime}
                  onChange={e => setHoldTime(parseInt(e.target.value))}
                  className="forti-input w-20"
                  disabled={!enabled}
                />
              </div>

              <div className="border-t border-[#eee] pt-2 mt-1 grid grid-cols-2 gap-1.5">
                {[
                  { label: 'Local AS', value: localAS, color: 'text-[#333]' },
                  { label: 'Neighbors', value: neighbors.length, color: 'text-[#333]' },
                  { label: 'Established', value: neighbors.filter(n => n.status === 'established').length, color: 'text-green-600' },
                  { label: 'Prefixes', value: neighbors.reduce((a, n) => a + n.prefixesReceived, 0), color: 'text-[#333]' },
                ].map(stat => (
                  <div key={stat.label} className="border border-[#ddd] p-1.5 text-center">
                    <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
                    <div className="text-[10px] text-[#666]">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Neighbors table */}
          <div className="col-span-2 section">
            <div className="section-header">BGP Neighbors</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Neighbor IP</th>
                  <th>Remote AS</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Uptime</th>
                  <th>Prefixes Rcvd</th>
                </tr>
              </thead>
              <tbody>
                {neighbors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-[#999]">No BGP neighbors configured</td>
                  </tr>
                ) : neighbors.map(n => (
                  <tr key={n.id}>
                    <td className="font-mono">{n.ip}</td>
                    <td className="font-mono">{n.remoteAS}</td>
                    <td className="text-[#666]">{n.description}</td>
                    <td className={`font-medium ${STATUS_CLASS[n.status]}`}>{n.status.toUpperCase()}</td>
                    <td>{n.uptime}</td>
                    <td>{n.prefixesReceived.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
};

export default BGPConfig;
