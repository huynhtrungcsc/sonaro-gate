import { useState, useEffect } from 'react';
import { Shell } from '@/components/layout/Shell';
import { db, isApiConfigured } from '@/lib/postgrest';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { RefreshCw, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';

const getToken = () => localStorage.getItem('sonaro_token') ?? '';

async function applyIface(nicName: string, payload: {
  ip_mode: string; ip_address?: string | null; subnet?: string | null; gateway?: string | null;
}): Promise<{ success: boolean; message: string; root?: boolean }> {
  try {
    const res = await fetch(`/api/system/interfaces/${encodeURIComponent(nicName)}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(payload),
    });
    return res.json();
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

interface DetectedNIC {
  name: string;
  mac: string;
  ip: string;
  state: string;
  speed: string;
  driver?: string;
}

interface ZoneAssignment {
  zone: string;
  label: string;
  description: string;
  nic: string;
  ip: string;
  subnet: string;
  gateway: string;
  mode: 'dhcp' | 'static';
  required: boolean;
}


const InterfaceAssignment = () => {
  const [detectedNICs, setDetectedNICs] = useState<DetectedNIC[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [zones, setZones] = useState<ZoneAssignment[]>([
    {
      zone: 'WAN', label: 'WAN (Internet)',
      description: 'Connects to ISP/Internet. Usually gets IP via DHCP from your router or ISP.',
      nic: '', ip: '', subnet: '255.255.255.0', gateway: '', mode: 'dhcp', required: true,
    },
    {
      zone: 'LAN', label: 'LAN (Internal)',
      description: 'Your trusted internal network. Devices connect here for secure access.',
      nic: '', ip: '192.168.1.1', subnet: '255.255.255.0', gateway: '', mode: 'static', required: true,
    },
    {
      zone: 'DMZ', label: 'DMZ (Servers)',
      description: 'Isolated zone for public-facing servers (web, email). Separated from LAN.',
      nic: '', ip: '10.0.0.1', subnet: '255.255.255.0', gateway: '', mode: 'static', required: false,
    },
    {
      zone: 'GUEST', label: 'GUEST (Visitors)',
      description: 'Guest Wi-Fi or visitor network. No access to LAN resources.',
      nic: '', ip: '172.16.0.1', subnet: '255.255.255.0', gateway: '', mode: 'static', required: false,
    },
  ]);

  // Load existing assignments from DB
  useEffect(() => {
    loadFromDB();
  }, []);

  const loadFromDB = async () => {
    if (!isApiConfigured()) return;
    setIsLoading(true);
    try {
      const { data, error } = await (db.from('network_interfaces').select('*') as any);

      if (error) throw error;

      if (data && data.length > 0) {
        setZones(prev => prev.map(zone => {
          const dbIface = (data as any[]).find((d: any) => d.name === zone.zone || d.type === zone.zone);
          if (dbIface) {
            return {
              ...zone,
              nic: dbIface.mac || '',
              ip: dbIface.ip_address || zone.ip,
              subnet: dbIface.subnet || zone.subnet,
              gateway: dbIface.gateway || '',
            };
          }
          return zone;
        }));

        const nics: DetectedNIC[] = (data as any[]).map((d: any) => ({
          name: d.name,
          mac: d.mac || '',
          ip: d.ip_address || '',
          state: d.status || 'unknown',
          speed: d.speed || 'N/A',
        }));
        if (nics.length > 0) setDetectedNICs(nics);
      }
    } catch (err) {
      console.error('Failed to load interfaces:', err);
    }
    setIsLoading(false);
  };

  const updateZone = (index: number, field: string, value: string) => {
    setZones(prev => prev.map((z, i) => i === index ? { ...z, [field]: value } : z));
    setHasChanges(true);
  };

  const getUsedNICs = () => zones.map(z => z.nic).filter(Boolean);

  const handleSave = async () => {
    // Validate required zones
    for (const zone of zones) {
      if (zone.required && !zone.nic) {
        toast.error(`${zone.zone} interface is required!`);
        return;
      }
    }

    // Check for duplicate assignments
    const used = getUsedNICs();
    const duplicates = used.filter((v, i) => used.indexOf(v) !== i);
    if (duplicates.length > 0) {
      toast.error(`Duplicate NIC assignment: ${duplicates.join(', ')}`);
      return;
    }

    setIsSaving(true);
    let appliedToOs = false;
    try {
      for (const zone of zones) {
        if (!zone.nic) continue;

        const selectedNIC = detectedNICs.find(n => n.name === zone.nic);

        // Save zone→NIC mapping to DB
        const dbPayload = {
          name: zone.nic,       // use actual NIC name (e.g. eth0, ens3)
          type: zone.zone as "WAN" | "LAN" | "DMZ",
          status: 'up' as const,
          ip_address: zone.mode === 'dhcp' ? null : (zone.ip || null),
          subnet: zone.mode === 'dhcp' ? null : (zone.subnet || null),
          gateway: zone.gateway || null,
          mac: selectedNIC?.mac || null,
          speed: selectedNIC?.speed || null,
          mtu: 1500,
          ip_mode: zone.mode,
        };

        const { data: existing } = await (db.from('network_interfaces')
          .select('id')
          .eq('name', zone.nic)
          .maybeSingle() as any);

        if (existing) {
          await (db.from('network_interfaces').update(dbPayload).eq('id', existing.id) as any);
        } else {
          await (db.from('network_interfaces').insert(dbPayload) as any);
        }

        // Apply IP config to the actual NIC
        const applyPayload = {
          ip_mode: zone.mode,
          ip_address: zone.mode === 'static' ? zone.ip : null,
          subnet: zone.mode === 'static' ? zone.subnet : null,
          gateway: zone.gateway || null,
        };
        const result = await applyIface(zone.nic, applyPayload);
        if (result.root) appliedToOs = true;
      }

      toast.success(appliedToOs
        ? '✓ Assignments applied to OS and persisted via netplan'
        : '✓ Assignments saved. Run with sudo to apply to OS.'
      );
      setHasChanges(false);
    } catch (err) {
      toast.error('Failed to save interface assignments');
      console.error(err);
    }
    setIsSaving(false);
  };

  const nicCount = detectedNICs.length;
  const assignedCount = zones.filter(z => z.nic).length;

  return (
    <Shell>
      <div className="space-y-0">
        {/* Toolbar */}
        <div className="forti-toolbar">
          <span className="text-[11px] text-[#555] mr-2">
            NICs detected: <strong>{nicCount}</strong> &nbsp;|&nbsp; Zones assigned: <strong>{assignedCount}</strong> of {zones.length}
            {nicCount < 2 && <span className="text-red-600 ml-2">⚠ Need at least 2 NICs</span>}
          </span>
          <div className="flex-1" />
          <button
            onClick={loadFromDB}
            disabled={isLoading}
            className="forti-toolbar-btn"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className={cn("forti-toolbar-btn", hasChanges && "primary")}
          >
            <Save size={12} />
            {isSaving ? 'Saving...' : 'Apply Assignment'}
          </button>
        </div>

        {/* Warning banner */}
        {nicCount < 2 && (
          <div className="flex items-start gap-2 px-4 py-2 bg-red-50 border-x border-b border-red-200 text-[11px]">
            <AlertTriangle size={13} className="text-red-500 mt-0.5 shrink-0" />
            <span className="text-red-700">
              Insufficient interfaces: Sonaro Gate requires at least 2 NICs (WAN + LAN). Add another NIC and click Refresh.
            </span>
          </div>
        )}

        {/* Detected NICs Table */}
        <div className="bg-white border-x border-b border-[#ddd]">
          <div className="px-4 py-2 bg-[#f5f5f5] border-b border-[#ddd]">
            <span className="text-[11px] font-semibold text-[#555]">DETECTED PHYSICAL INTERFACES</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Interface</th>
                <th>MAC Address</th>
                <th>IP Address</th>
                <th>State</th>
                <th>Speed</th>
                <th>Assigned To</th>
              </tr>
            </thead>
            <tbody>
              {detectedNICs.map(nic => {
                const assignedZone = zones.find(z => z.nic === nic.name);
                return (
                  <tr key={nic.name}>
                    <td className="font-medium font-mono text-[#111]">{nic.name}</td>
                    <td className="font-mono text-[11px] text-[#555]">{nic.mac || 'N/A'}</td>
                    <td className="font-mono text-[11px] text-[#333]">{nic.ip || '—'}</td>
                    <td>
                      <span className={cn(
                        "text-[11px] font-medium",
                        nic.state === 'up' ? 'text-[#4caf50]' : 'text-[#999]'
                      )}>
                        {nic.state === 'up' ? '● up' : '○ down'}
                      </span>
                    </td>
                    <td className="text-[11px] text-[#555]">{nic.speed}</td>
                    <td className="text-[11px]">
                      {assignedZone
                        ? <span className="text-[#4caf50] font-medium">{assignedZone.zone}</span>
                        : <span className="text-[#999]">—</span>
                      }
                    </td>
                  </tr>
                );
              })}
              {detectedNICs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-[#999] py-8">
                    {'No interfaces detected. Run the agent installer on your Ubuntu host.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Zone Assignment Table */}
        <div className="section">
          <div className="section-header">Zone Assignment</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Zone</th>
                <th>Description</th>
                <th>Interface</th>
                <th>Address Mode</th>
                <th>IP Address</th>
                <th>Subnet Mask</th>
                <th>Gateway</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((zone, idx) => (
                <tr key={zone.zone}>
                  <td className="font-medium text-[#333]">
                    {zone.label}
                    {zone.required && <span className="text-red-500 ml-1 text-[10px]">*</span>}
                    {zone.nic && <span className="ml-2 text-[10px] text-[#4caf50]">● assigned</span>}
                  </td>
                  <td className="text-[11px] text-[#777]">{zone.description}</td>
                  <td>
                    <select
                      className="forti-select w-36"
                      value={zone.nic || '__none__'}
                      onChange={(e) => updateZone(idx, 'nic', e.target.value === '__none__' ? '' : e.target.value)}
                    >
                      <option value="__none__">— None —</option>
                      {detectedNICs.map(nic => {
                        const usedBy = zones.find(z => z.nic === nic.name && z.zone !== zone.zone);
                        return (
                          <option key={nic.name} value={nic.name} disabled={!!usedBy}>
                            {nic.name} {nic.state === 'up' ? '●' : '○'}{usedBy ? ` [${usedBy.zone}]` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </td>
                  <td>
                    <select
                      className="forti-select w-32"
                      value={zone.mode}
                      onChange={(e) => updateZone(idx, 'mode', e.target.value)}
                    >
                      <option value="dhcp">DHCP</option>
                      <option value="static">Static</option>
                    </select>
                  </td>
                  <td>
                    {zone.mode === 'static' ? (
                      <input
                        className="forti-input w-32 font-mono"
                        value={zone.ip}
                        onChange={(e) => updateZone(idx, 'ip', e.target.value)}
                        placeholder="192.168.1.1"
                      />
                    ) : (
                      <span className="text-[11px] text-[#999]">Via DHCP</span>
                    )}
                  </td>
                  <td>
                    {zone.mode === 'static' ? (
                      <select
                        className="forti-select w-44 font-mono"
                        value={zone.subnet}
                        onChange={(e) => updateZone(idx, 'subnet', e.target.value)}
                      >
                        <option value="255.255.255.0">255.255.255.0 (/24)</option>
                        <option value="255.255.0.0">255.255.0.0 (/16)</option>
                        <option value="255.255.255.128">255.255.255.128 (/25)</option>
                        <option value="255.255.255.192">255.255.255.192 (/26)</option>
                        <option value="255.255.255.240">255.255.255.240 (/28)</option>
                      </select>
                    ) : (
                      <span className="text-[11px] text-[#999]">—</span>
                    )}
                  </td>
                  <td>
                    {zone.mode === 'static' ? (
                      <input
                        className="forti-input w-32 font-mono"
                        value={zone.gateway}
                        onChange={(e) => updateZone(idx, 'gateway', e.target.value)}
                        placeholder={zone.zone === 'WAN' ? 'ISP gateway' : 'Optional'}
                      />
                    ) : (
                      <span className="text-[11px] text-[#999]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
};

export default InterfaceAssignment;
