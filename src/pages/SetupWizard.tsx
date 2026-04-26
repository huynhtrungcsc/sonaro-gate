import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shell } from '@/components/layout/Shell';
import {
  Shield, ChevronRight, ChevronLeft, Check, Network, Globe,
  Server, Lock, Loader2, AlertTriangle, Wifi,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/postgrest';

interface NicInfo {
  id: string;
  name: string;
  ip_address: string | null;
  ip_mode: string;
  type: string;
  status: string;
  mac: string | null;
}

type WanMode = 'dhcp' | 'static';

interface WizardState {
  wanName: string;
  wanMode: WanMode;
  wanIp: string;
  wanSubnet: string;
  wanGateway: string;
  lanName: string;
  lanIp: string;
  lanSubnet: string;
  adminPassword: string;
  adminPasswordConfirm: string;
}

const SUBNETS = [
  { label: '/8  — 255.0.0.0', value: '255.0.0.0' },
  { label: '/16 — 255.255.0.0', value: '255.255.0.0' },
  { label: '/24 — 255.255.255.0 (254 hosts)', value: '255.255.255.0' },
  { label: '/25 — 255.255.255.128 (126 hosts)', value: '255.255.255.128' },
  { label: '/26 — 255.255.255.192 (62 hosts)', value: '255.255.255.192' },
  { label: '/27 — 255.255.255.224 (30 hosts)', value: '255.255.255.224' },
  { label: '/28 — 255.255.255.240 (14 hosts)', value: '255.255.255.240' },
  { label: '/30 — 255.255.255.252 (2 hosts)', value: '255.255.255.252' },
];

const STEPS = [
  { id: 1, label: 'Welcome',    icon: Shield },
  { id: 2, label: 'Interfaces', icon: Network },
  { id: 3, label: 'WAN',        icon: Globe },
  { id: 4, label: 'LAN',        icon: Server },
  { id: 5, label: 'Password',   icon: Lock },
  { id: 6, label: 'Done',       icon: Check },
];

export default function SetupWizard() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [nics, setNics] = useState<NicInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [doneResult, setDoneResult] = useState<{ lanIp: string; root: boolean } | null>(null);

  const [form, setForm] = useState<WizardState>({
    wanName: '',
    wanMode: 'dhcp',
    wanIp: '',
    wanSubnet: '255.255.255.0',
    wanGateway: '',
    lanName: '',
    lanIp: '192.168.1.1',
    lanSubnet: '255.255.255.0',
    adminPassword: '',
    adminPasswordConfirm: '',
  });

  const set = (k: keyof WizardState, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    apiFetch('/api/setup/status')
      .then((data: any) => {
        if (data.complete) { navigate('/', { replace: true }); return; }
        const list: NicInfo[] = data.interfaces || [];
        setNics(list);
        const wan = list.find(n => n.type === 'WAN') ?? list[0];
        const lan = list.find(n => n.type === 'LAN') ?? list[1];
        setForm(f => ({
          ...f,
          wanName: wan?.name ?? '',
          lanName: lan?.name ?? '',
        }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [navigate]);

  const handleApply = async () => {
    setApplying(true);
    try {
      const result: any = await apiFetch('/api/setup/apply', {
        method: 'POST',
        body: JSON.stringify({
          wan: {
            name: form.wanName,
            mode: form.wanMode,
            ip: form.wanMode === 'static' ? form.wanIp : undefined,
            subnet: form.wanMode === 'static' ? form.wanSubnet : undefined,
            gateway: form.wanGateway || undefined,
          },
          lan: { name: form.lanName, ip: form.lanIp, subnet: form.lanSubnet },
          adminPassword: form.adminPassword || undefined,
        }),
      });
      if (result.success) {
        setDoneResult({ lanIp: result.lanIp, root: result.root });
        setStep(6);
      } else {
        toast.error(result.message || 'Setup failed');
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Setup failed');
    } finally {
      setApplying(false);
    }
  };

  const canNextStep2 = form.wanName && form.lanName && form.wanName !== form.lanName;
  const canNextStep3 = form.wanMode === 'dhcp' || (!!form.wanIp && !!form.wanSubnet);
  const canNextStep4 = !!form.lanIp && !!form.lanSubnet;
  const canNextStep5 =
    (!form.adminPassword && !form.adminPasswordConfirm) ||
    (form.adminPassword.length >= 8 && form.adminPassword === form.adminPasswordConfirm);

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center h-64 gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-[#4caf50]" />
          <span className="text-[11px] text-[#666]">Detecting network interfaces…</span>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-0 animate-slide-in">

        {/* ── Toolbar ──────────────────────────────────────────────── */}
        <div className="forti-toolbar">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step <= 1 || step === 6}
            className="forti-toolbar-btn"
          >
            <ChevronLeft className="w-3 h-3" />
            Previous
          </button>

          <div className="forti-toolbar-separator" />

          {step < 5 && (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={
                (step === 2 && !canNextStep2) ||
                (step === 3 && !canNextStep3) ||
                (step === 4 && !canNextStep4)
              }
              className="forti-toolbar-btn primary"
            >
              Next
              <ChevronRight className="w-3 h-3" />
            </button>
          )}

          {step === 5 && (
            <button
              onClick={handleApply}
              disabled={applying || !canNextStep5}
              className="forti-toolbar-btn primary"
            >
              {applying
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Applying…</>
                : <><Check className="w-3 h-3" /> Finish Setup</>}
            </button>
          )}

          {step === 6 && (
            <button
              onClick={() => navigate('/', { replace: true })}
              className="forti-toolbar-btn primary"
            >
              <Shield className="w-3 h-3" />
              Open Dashboard
            </button>
          )}

          <div className="flex-1" />

          {/* Step indicator pills */}
          <div className="flex items-center gap-0.5 mr-1">
            {STEPS.map(s => {
              const Icon = s.icon;
              const done = step > s.id;
              const active = step === s.id;
              return (
                <div
                  key={s.id}
                  title={s.label}
                  className={`flex items-center gap-1 px-2 py-0.5 text-[10px] border transition-colors ${
                    done
                      ? 'bg-[hsl(142,70%,35%)] border-[hsl(142,70%,30%)] text-white'
                      : active
                      ? 'bg-white border-[hsl(142,70%,35%)] text-[hsl(142,70%,35%)] font-semibold'
                      : 'bg-[#f5f5f5] border-[#ccc] text-[#999]'
                  }`}
                >
                  {done ? <Check className="w-2.5 h-2.5" /> : <Icon className="w-2.5 h-2.5" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Content ──────────────────────────────────────────────── */}
        <div className="p-4">
          <div className="max-w-2xl">
            <div className="section">
              <div className="section-header-neutral">
                <div className="flex items-center gap-2">
                  {(() => { const s = STEPS[step - 1]; const Icon = s.icon; return <Icon className="w-3.5 h-3.5" />; })()}
                  <span>Step {step} of {STEPS.length} — {STEPS[step - 1].label}</span>
                </div>
                <span className="text-[10px] text-[#888] font-normal">Initial Setup Wizard</span>
              </div>
              <div className="section-body">
                {step === 1 && <StepWelcome nics={nics} />}
                {step === 2 && <StepInterfaces nics={nics} form={form} set={set} />}
                {step === 3 && <StepWan form={form} set={set} />}
                {step === 4 && <StepLan form={form} set={set} />}
                {step === 5 && <StepPassword form={form} set={set} />}
                {step === 6 && doneResult && <StepDone result={doneResult} />}
              </div>
            </div>
          </div>
        </div>

      </div>
    </Shell>
  );
}

// ─── Step Components ──────────────────────────────────────────────────────────

function StepWelcome({ nics }: { nics: NicInfo[] }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-[#333] mb-1">Welcome to Sonaro Gate</h2>
        <p className="text-[11px] text-[#666]">
          This wizard guides you through the initial firewall configuration. You will assign
          network interfaces, configure WAN and LAN addresses, and set the admin password.
        </p>
      </div>

      <div className="section">
        <div className="section-header-neutral">
          <div className="flex items-center gap-2">
            <Wifi className="w-3 h-3" />
            <span>Detected Network Interfaces</span>
          </div>
        </div>
        <div className="p-3">
          {nics.length === 0 ? (
            <p className="text-[11px] text-[#888]">No interfaces detected. Start server with <code className="font-mono bg-[#f5f5f5] px-1">sudo</code> to enable NIC detection.</p>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[#eee]">
                  <th className="text-left py-1 pr-4 font-medium text-[#666]">Interface</th>
                  <th className="text-left py-1 pr-4 font-medium text-[#666]">MAC Address</th>
                  <th className="text-left py-1 pr-4 font-medium text-[#666]">IP Address</th>
                  <th className="text-left py-1 font-medium text-[#666]">State</th>
                </tr>
              </thead>
              <tbody>
                {nics.map(n => (
                  <tr key={n.id} className="border-b border-[#f5f5f5]">
                    <td className="py-1 pr-4 font-mono text-[#333]">{n.name}</td>
                    <td className="py-1 pr-4 font-mono text-[#666]">{n.mac ?? '—'}</td>
                    <td className="py-1 pr-4 font-mono text-[#333]">{n.ip_address ?? 'no IP'}</td>
                    <td className="py-1">
                      <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        n.status === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${n.status === 'up' ? 'bg-green-500' : 'bg-red-500'}`} />
                        {n.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 text-[11px]">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-amber-800">
          <strong>Important:</strong> After setup, connect to the management console
          via the <strong>LAN IP address</strong> — not the WAN address. This ensures
          changes to WAN settings never disconnect you from the management UI.
        </p>
      </div>
    </div>
  );
}

function StepInterfaces({ nics, form, set }: {
  nics: NicInfo[];
  form: WizardState;
  set: (k: keyof WizardState, v: string) => void;
}) {
  const availableForLan = nics.filter(n => n.name !== form.wanName);
  const availableForWan = nics.filter(n => n.name !== form.lanName);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-[#333] mb-1">Interface Assignment</h2>
        <p className="text-[11px] text-[#666]">
          Assign each physical NIC to a role. <strong>WAN</strong> is the uplink to the internet.
          <strong> LAN</strong> is the internal management network — you will access this console via the LAN IP.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Globe className="w-3.5 h-3.5 text-blue-500" />
            <label className="forti-label mb-0 text-blue-700 font-semibold">WAN Interface</label>
          </div>
          <p className="text-[10px] text-[#888] mb-2">Internet uplink (connects to ISP / upstream router)</p>
          {nics.length === 0 ? (
            <input
              className="forti-input w-full"
              placeholder="e.g. ens33"
              value={form.wanName}
              onChange={e => set('wanName', e.target.value)}
            />
          ) : (
            <select
              value={form.wanName}
              onChange={e => set('wanName', e.target.value)}
              className="forti-select w-full"
            >
              <option value="">— Select —</option>
              {availableForWan.map(n => (
                <option key={n.name} value={n.name}>
                  {n.name}{n.ip_address ? ` (${n.ip_address})` : ' (no IP)'}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Server className="w-3.5 h-3.5 text-purple-500" />
            <label className="forti-label mb-0 text-purple-700 font-semibold">LAN Interface</label>
          </div>
          <p className="text-[10px] text-[#888] mb-2">Management network (access this console via LAN IP)</p>
          {nics.length === 0 ? (
            <input
              className="forti-input w-full"
              placeholder="e.g. ens34"
              value={form.lanName}
              onChange={e => set('lanName', e.target.value)}
            />
          ) : (
            <select
              value={form.lanName}
              onChange={e => set('lanName', e.target.value)}
              className="forti-select w-full"
            >
              <option value="">— Select —</option>
              {availableForLan.map(n => (
                <option key={n.name} value={n.name}>
                  {n.name}{n.ip_address ? ` (${n.ip_address})` : ' (no IP)'}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {form.wanName && form.lanName && form.wanName === form.lanName && (
        <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 text-[11px] text-red-700">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          WAN and LAN must be different interfaces.
        </div>
      )}

      {form.wanName && form.lanName && form.wanName !== form.lanName && (
        <div className="p-3 bg-[#f5f5f5] border border-[#e0e0e0] text-[11px]">
          <div className="flex gap-6">
            <div><span className="text-[#888]">WAN:</span> <span className="font-mono font-medium">{form.wanName}</span> <span className="text-[9px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded uppercase font-bold">Internet</span></div>
            <div><span className="text-[#888]">LAN:</span> <span className="font-mono font-medium">{form.lanName}</span> <span className="text-[9px] bg-purple-100 text-purple-700 px-1 py-0.5 rounded uppercase font-bold">Management</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepWan({ form, set }: { form: WizardState; set: (k: keyof WizardState, v: string) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-[#333] mb-1">WAN Configuration</h2>
        <p className="text-[11px] text-[#666]">
          Configure how <strong className="font-mono">{form.wanName || 'WAN'}</strong> connects to the internet.
          Use DHCP if your ISP assigns addresses automatically.
        </p>
      </div>

      <div>
        <label className="forti-label">IP Assignment Mode</label>
        <div className="flex gap-2">
          {(['dhcp', 'static'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => set('wanMode', mode)}
              className={`flex-1 flex flex-col items-start p-3 border text-left transition-colors text-[11px] ${
                form.wanMode === mode
                  ? 'border-[hsl(142,70%,35%)] bg-green-50 text-[hsl(142,70%,30%)]'
                  : 'border-[#ccc] bg-white text-[#666] hover:bg-[#f5f5f5]'
              }`}
            >
              <span className="font-semibold mb-0.5">{mode === 'dhcp' ? 'DHCP' : 'Static IP'}</span>
              <span className="text-[10px] opacity-80">
                {mode === 'dhcp' ? 'ISP assigns address automatically' : 'Manually configure IP address'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {form.wanMode === 'static' && (
        <div className="space-y-3">
          <div>
            <label className="forti-label">WAN IP Address</label>
            <input
              className="forti-input w-full font-mono"
              placeholder="e.g. 203.0.113.10"
              value={form.wanIp}
              onChange={e => set('wanIp', e.target.value)}
            />
          </div>
          <div>
            <label className="forti-label">Subnet Mask</label>
            <select
              value={form.wanSubnet}
              onChange={e => set('wanSubnet', e.target.value)}
              className="forti-select w-full font-mono"
            >
              {SUBNETS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="forti-label">Default Gateway <span className="text-[#999] font-normal">(optional)</span></label>
            <input
              className="forti-input w-full font-mono"
              placeholder="e.g. 203.0.113.1"
              value={form.wanGateway}
              onChange={e => set('wanGateway', e.target.value)}
            />
          </div>
        </div>
      )}

      {form.wanMode === 'dhcp' && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 text-[11px] text-blue-800">
          <Globe className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500" />
          <p>DHCP selected — the IP address will be assigned automatically by your ISP or upstream router when setup completes.</p>
        </div>
      )}
    </div>
  );
}

function StepLan({ form, set }: { form: WizardState; set: (k: keyof WizardState, v: string) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-[#333] mb-1">LAN Configuration</h2>
        <p className="text-[11px] text-[#666]">
          Set the static IP for <strong className="font-mono">{form.lanName || 'LAN'}</strong>.
          This is the management address — you will access this dashboard at this IP after setup.
        </p>
      </div>

      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 text-[11px] text-blue-800">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500" />
        <p>
          After clicking <strong>Finish Setup</strong>, reconnect to the management console at{' '}
          <strong className="font-mono">http://{form.lanIp || '192.168.1.1'}</strong>.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="forti-label">LAN IP Address</label>
          <input
            className="forti-input w-full font-mono"
            placeholder="e.g. 192.168.1.1"
            value={form.lanIp}
            onChange={e => set('lanIp', e.target.value)}
          />
        </div>
        <div>
          <label className="forti-label">Subnet Mask</label>
          <select
            value={form.lanSubnet}
            onChange={e => set('lanSubnet', e.target.value)}
            className="forti-select w-full font-mono"
          >
            {SUBNETS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

function StepPassword({ form, set }: { form: WizardState; set: (k: keyof WizardState, v: string) => void }) {
  const [show, setShow] = useState(false);
  const mismatch = form.adminPassword && form.adminPasswordConfirm && form.adminPassword !== form.adminPasswordConfirm;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-[#333] mb-1">Admin Password</h2>
        <p className="text-[11px] text-[#666]">
          Change the default admin password. Leave blank to keep the current password
          (<code className="font-mono bg-[#f5f5f5] px-1">Admin123!</code>).
          Minimum 8 characters required.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="forti-label">New Password</label>
          <div className="flex gap-1">
            <input
              type={show ? 'text' : 'password'}
              className="forti-input flex-1"
              placeholder="Leave blank to keep current"
              value={form.adminPassword}
              onChange={e => set('adminPassword', e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShow(v => !v)}
              className="forti-toolbar-btn px-2"
              title={show ? 'Hide password' : 'Show password'}
            >
              <Lock className="w-3 h-3" />
            </button>
          </div>
        </div>

        {form.adminPassword && (
          <div>
            <label className="forti-label">Confirm Password</label>
            <input
              type={show ? 'text' : 'password'}
              className={`forti-input w-full ${mismatch ? 'border-red-400' : ''}`}
              placeholder="Repeat new password"
              value={form.adminPasswordConfirm}
              onChange={e => set('adminPasswordConfirm', e.target.value)}
            />
            {mismatch && <p className="text-[11px] text-red-600 mt-1">Passwords do not match</p>}
          </div>
        )}
      </div>

      <div className="section">
        <div className="section-header-neutral">
          <span>Configuration Review</span>
        </div>
        <div className="p-3">
          <table className="w-full text-[11px]">
            <tbody>
              <tr className="border-b border-[#f5f5f5]">
                <td className="py-1 pr-4 text-[#888] w-24">WAN</td>
                <td className="py-1 font-mono">
                  {form.wanName} — {form.wanMode.toUpperCase()}
                  {form.wanMode === 'static' && form.wanIp ? ` ${form.wanIp}/${form.wanSubnet}` : ''}
                </td>
              </tr>
              <tr className="border-b border-[#f5f5f5]">
                <td className="py-1 pr-4 text-[#888]">LAN</td>
                <td className="py-1 font-mono">{form.lanName} — {form.lanIp}/{form.lanSubnet}</td>
              </tr>
              <tr>
                <td className="py-1 pr-4 text-[#888]">Password</td>
                <td className="py-1 text-[#666]">{form.adminPassword ? 'Will be changed' : 'Keep current (Admin123!)'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StepDone({ result }: { result: { lanIp: string; root: boolean } }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200">
        <div className="w-10 h-10 rounded-full bg-[hsl(142,70%,35%)] flex items-center justify-center shrink-0">
          <Check className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[#333]">Setup Complete</h2>
          <p className="text-[11px] text-[#666]">Sonaro Gate has been successfully configured.</p>
        </div>
      </div>

      <div className="section">
        <div className="section-header-neutral">
          <span>Access Information</span>
        </div>
        <div className="p-3 space-y-3 text-[11px]">
          <div className="flex items-start gap-2">
            <Globe className="w-3.5 h-3.5 text-[#888] mt-0.5 shrink-0" />
            <div>
              <div className="text-[#666] mb-0.5">Management URL</div>
              <a
                href={`http://${result.lanIp}`}
                className="font-mono text-[hsl(142,70%,35%)] hover:underline"
              >
                http://{result.lanIp}
              </a>
              <p className="text-[10px] text-[#999] mt-0.5">
                Connect a device to the LAN network and navigate to this address.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Shield className="w-3.5 h-3.5 text-[#888] mt-0.5 shrink-0" />
            <div>
              <div className="text-[#666] mb-0.5">Login Credentials</div>
              <div className="font-mono">admin@sonaro.local</div>
              <div className="text-[#999] text-[10px] mt-0.5">
                Use the password configured in the previous step (or <code>Admin123!</code> if left blank).
              </div>
            </div>
          </div>

          {!result.root && (
            <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <p>
                Server is not running as root — network interface settings were saved to the database
                but IP addresses were not applied to the system. On production, run with <code className="font-mono">sudo</code>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
