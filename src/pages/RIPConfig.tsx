import { Shell } from '@/components/layout/Shell';
import { useState } from 'react';
import { FortiToggle } from '@/components/ui/forti-toggle';
import { toast } from 'sonner';
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

interface RIPNetwork {
  id: string;
  network: string;
}

interface RIPInterface {
  name: string;
  passive: boolean;
  splitHorizon: boolean;
  authentication: 'none' | 'text' | 'md5';
}

const RIPConfig = () => {
  const [enabled, setEnabled] = useState(false);
  const [version, setVersion] = useState<'1' | '2'>('2');
  const [defaultMetric, setDefaultMetric] = useState(1);
  const [updateTimer, setUpdateTimer] = useState(30);
  const [networks, setNetworks] = useState<RIPNetwork[]>([]);
  const [interfaces, setInterfaces] = useState<RIPInterface[]>([]);

  const [addNetworkOpen, setAddNetworkOpen] = useState(false);
  const [newNetwork, setNewNetwork] = useState('');
  const [deleteNetworkId, setDeleteNetworkId] = useState<string | null>(null);

  const handleAddNetwork = () => {
    if (!newNetwork.trim()) { toast.error('Network address is required'); return; }
    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(newNetwork.trim())) {
      toast.error('Invalid format. Use CIDR notation (e.g., 10.0.0.0/8)'); return;
    }
    setNetworks(prev => [...prev, { id: Date.now().toString(), network: newNetwork.trim() }]);
    setNewNetwork('');
    setAddNetworkOpen(false);
    toast.success(`Network "${newNetwork.trim()}" added`);
  };

  const handleDeleteNetwork = () => {
    if (!deleteNetworkId) return;
    const net = networks.find(n => n.id === deleteNetworkId);
    setNetworks(prev => prev.filter(n => n.id !== deleteNetworkId));
    setDeleteNetworkId(null);
    toast.success(`Network "${net?.network}" removed`);
  };

  const handleTogglePassive = (name: string) =>
    setInterfaces(prev => prev.map(i => i.name === name ? { ...i, passive: !i.passive } : i));

  const handleToggleSplitHorizon = (name: string) =>
    setInterfaces(prev => prev.map(i => i.name === name ? { ...i, splitHorizon: !i.splitHorizon } : i));

  const handleAuthChange = (name: string, auth: RIPInterface['authentication']) =>
    setInterfaces(prev => prev.map(i => i.name === name ? { ...i, authentication: auth } : i));

  return (
    <Shell>
      <div className="space-y-0">
        <div className="forti-toolbar">
          <button
            className="forti-toolbar-btn primary"
            disabled={!enabled}
            onClick={() => setAddNetworkOpen(true)}
          >
            + Create New
          </button>
          <div className="forti-toolbar-separator" />
          <button className="forti-toolbar-btn" onClick={() => toast.success('RIP configuration applied')}>Apply</button>
          <button className="forti-toolbar-btn" onClick={() => toast.success('Configuration refreshed')}>Refresh</button>
        </div>

        <div className="grid grid-cols-3 gap-4 p-3">
          {/* Basic Settings */}
          <div className="col-span-1 section">
            <div className="section-header">Basic Settings</div>
            <div className="section-body space-y-2">
              <div className="flex items-center justify-between py-0.5">
                <span className="forti-label-inline">Enable RIP</span>
                <FortiToggle enabled={enabled} onToggle={() => setEnabled(v => !v)} />
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="forti-label-inline">Version</span>
                <select
                  value={version}
                  onChange={e => setVersion(e.target.value as '1' | '2')}
                  className="forti-select"
                  disabled={!enabled}
                >
                  <option value="1">RIP v1</option>
                  <option value="2">RIP v2</option>
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
                <span className="forti-label-inline">Update Timer (s)</span>
                <input
                  type="number"
                  value={updateTimer}
                  onChange={e => setUpdateTimer(Number(e.target.value))}
                  className="forti-input w-20"
                  disabled={!enabled}
                />
              </div>
            </div>
          </div>

          {/* Networks + Interfaces */}
          <div className="col-span-2 space-y-3">
            <div className="section">
              <div className="section-header flex items-center justify-between">
                <span>Networks</span>
                <button
                  className="text-white/80 hover:text-white text-[11px]"
                  onClick={() => setAddNetworkOpen(true)}
                  disabled={!enabled}
                >
                  + Add
                </button>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Network (CIDR)</th>
                    <th className="w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {networks.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="text-center py-6 text-[#999]">No networks configured</td>
                    </tr>
                  ) : networks.map(net => (
                    <tr key={net.id}>
                      <td className="font-mono">{net.network}</td>
                      <td>
                        <button
                          className="text-red-500 hover:text-red-700 text-[11px]"
                          onClick={() => setDeleteNetworkId(net.id)}
                        >
                          Delete
                        </button>
                      </td>
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
                    <th>Passive</th>
                    <th>Split Horizon</th>
                    <th>Authentication</th>
                  </tr>
                </thead>
                <tbody>
                  {interfaces.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-6 text-[#999]">No interfaces configured</td>
                    </tr>
                  ) : interfaces.map(intf => (
                    <tr key={intf.name}>
                      <td className="font-medium">{intf.name}</td>
                      <td><FortiToggle enabled={intf.passive} onToggle={() => handleTogglePassive(intf.name)} size="sm" /></td>
                      <td><FortiToggle enabled={intf.splitHorizon} onToggle={() => handleToggleSplitHorizon(intf.name)} size="sm" /></td>
                      <td>
                        <select
                          value={intf.authentication}
                          onChange={e => handleAuthChange(intf.name, e.target.value as RIPInterface['authentication'])}
                          className="forti-select"
                        >
                          <option value="none">NONE</option>
                          <option value="text">TEXT</option>
                          <option value="md5">MD5</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Add Network Dialog */}
      <Dialog open={addNetworkOpen} onOpenChange={setAddNetworkOpen}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-sm">Add RIP Network</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="forti-label">Network (CIDR)</label>
              <input
                type="text"
                value={newNetwork}
                onChange={e => setNewNetwork(e.target.value)}
                placeholder="e.g., 10.0.0.0/8"
                className="forti-input w-full font-mono"
                onKeyDown={e => e.key === 'Enter' && handleAddNetwork()}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button className="forti-toolbar-btn" onClick={() => setAddNetworkOpen(false)}>Cancel</button>
              <button className="forti-toolbar-btn primary" onClick={handleAddNetwork}>Add</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteNetworkId} onOpenChange={() => setDeleteNetworkId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Network</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this network from RIP configuration?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteNetwork}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
};

export default RIPConfig;
