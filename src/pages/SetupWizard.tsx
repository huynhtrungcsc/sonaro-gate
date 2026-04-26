import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, ChevronRight, ChevronLeft, Check, Network, Globe, Server, Lock, Loader2, AlertTriangle, Wifi } from 'lucide-react';
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
  { label: '/8 — 255.0.0.0', value: '255.0.0.0' },
  { label: '/16 — 255.255.0.0', value: '255.255.0.0' },
  { label: '/24 — 255.255.255.0 (254 hosts)', value: '255.255.255.0' },
  { label: '/25 — 255.255.255.128 (126 hosts)', value: '255.255.255.128' },
  { label: '/26 — 255.255.255.192 (62 hosts)', value: '255.255.255.192' },
  { label: '/27 — 255.255.255.224 (30 hosts)', value: '255.255.255.224' },
  { label: '/28 — 255.255.255.240 (14 hosts)', value: '255.255.255.240' },
  { label: '/30 — 255.255.255.252 (2 hosts)', value: '255.255.255.252' },
];

const STEPS = [
  { id: 1, label: 'Welcome',     icon: Shield },
  { id: 2, label: 'Interfaces',  icon: Network },
  { id: 3, label: 'WAN',         icon: Globe },
  { id: 4, label: 'LAN',         icon: Server },
  { id: 5, label: 'Password',    icon: Lock },
  { id: 6, label: 'Done',        icon: Check },
];

export default function SetupWizard() {
  const navigate = useNavigate();
  const { user } = useAuth();

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
          lanName: lan?.name ?? (wan ? '' : ''),
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
      <div className="min-h-screen flex items-center justify-center bg-[#090c10]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#4caf50] animate-spin" />
          <span className="text-[#5a6e80] text-sm">Detecting network interfaces…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090c10] flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-[#4caf50]" />
            <span className="text-2xl font-bold tracking-widest text-white">SONARO <span className="text-[#4caf50]">GATE</span></span>
          </div>
          <p className="text-[#5a6e80] text-sm tracking-widest uppercase">Initial Setup Wizard</p>
        </div>

        {/* Step progress */}
        <div className="flex items-center justify-between mb-8 px-2">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const done = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    done ? 'bg-[#4caf50] border-[#4caf50] text-white' :
                    active ? 'bg-transparent border-[#4caf50] text-[#4caf50]' :
                    'bg-transparent border-[#1a2030] text-[#3d4d5c]'
                  }`}>
                    {done ? <Check size={14} /> : <Icon size={14} />}
                  </div>
                  <span className={`text-[10px] mt-1 font-medium ${active ? 'text-[#4caf50]' : done ? 'text-[#5a6e80]' : 'text-[#2d3a46]'}`}>
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-2 mb-4 ${done ? 'bg-[#4caf50]' : 'bg-[#1a2030]'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="bg-[#0f1318] border border-[#1a2030] rounded-lg overflow-hidden">
          {/* Step content */}
          <div className="p-8">
            {step === 1 && <StepWelcome nics={nics} />}
            {step === 2 && <StepInterfaces nics={nics} form={form} set={set} />}
            {step === 3 && <StepWan form={form} set={set} />}
            {step === 4 && <StepLan form={form} set={set} />}
            {step === 5 && <StepPassword form={form} set={set} />}
            {step === 6 && doneResult && <StepDone result={doneResult} />}
          </div>

          {/* Footer nav */}
          {step < 6 && (
            <div className="px-8 py-4 border-t border-[#1a2030] flex items-center justify-between">
              <button
                onClick={() => setStep(s => s - 1)}
                disabled={step === 1}
                className="flex items-center gap-2 px-4 py-2 text-sm text-[#5a6e80] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} /> Previous
              </button>

              {step < 5 ? (
                <button
                  onClick={() => setStep(s => s + 1)}
                  disabled={
                    (step === 2 && !canNextStep2) ||
                    (step === 3 && !canNextStep3) ||
                    (step === 4 && !canNextStep4)
                  }
                  className="flex items-center gap-2 px-6 py-2 bg-[#4caf50] hover:bg-[#43a047] text-white text-sm font-medium rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={handleApply}
                  disabled={applying || !canNextStep5}
                  className="flex items-center gap-2 px-6 py-2 bg-[#4caf50] hover:bg-[#43a047] text-white text-sm font-medium rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {applying ? <><Loader2 size={14} className="animate-spin" /> Applying…</> : <><Check size={14} /> Finish Setup</>}
                </button>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="px-8 py-4 border-t border-[#1a2030] flex justify-center">
              <button
                onClick={() => navigate('/', { replace: true })}
                className="flex items-center gap-2 px-8 py-2 bg-[#4caf50] hover:bg-[#43a047] text-white text-sm font-medium rounded transition-colors"
              >
                <Shield size={14} /> Open Dashboard
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-[#2d3a46] text-xs mt-6">
          Sonaro Gate — Security Management Console
        </p>
      </div>
    </div>
  );
}

function StepWelcome({ nics }: { nics: NicInfo[] }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-2">Welcome to Sonaro Gate</h2>
      <p className="text-[#5a6e80] text-sm mb-6">
        This wizard will guide you through the initial configuration of your firewall.
        You will assign network interfaces, configure WAN and LAN addresses, and set
        the management password.
      </p>

      <div className="bg-[#0c0f14] border border-[#1a2030] rounded p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Wifi size={14} className="text-[#4caf50]" />
          <span className="text-sm font-medium text-white">Detected Network Interfaces</span>
        </div>
        {nics.length === 0 ? (
          <p className="text-[#5a6e80] text-xs">No interfaces detected. Start server with sudo to enable NIC detection.</p>
        ) : (
          <div className="space-y-2">
            {nics.map(n => (
              <div key={n.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${n.status === 'up' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-white font-mono">{n.name}</span>
                  <span className="text-[#5a6e80]">{n.mac}</span>
                </div>
                <span className="text-[#3d4d5c] font-mono">{n.ip_address ?? 'no IP'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-start gap-3 bg-[#1a1500] border border-[#3d2e00] rounded p-3">
        <AlertTriangle size={14} className="text-yellow-500 mt-0.5 shrink-0" />
        <p className="text-xs text-[#a08030]">
          <strong className="text-yellow-400">Important:</strong> After setup, access the management console
          via the <strong>LAN IP address</strong> you configure below — not the WAN address.
          This ensures changing WAN settings never disconnects you from the management UI.
        </p>
      </div>
    </div>
  );
}

function StepInterfaces({ nics, form, set }: { nics: NicInfo[]; form: WizardState; set: (k: keyof WizardState, v: string) => void }) {
  const availableForLan = nics.filter(n => n.name !== form.wanName);
  const availableForWan = nics.filter(n => n.name !== form.lanName);

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-2">Interface Assignment</h2>
      <p className="text-[#5a6e80] text-sm mb-6">
        Assign each physical NIC to a role. <strong className="text-white">WAN</strong> is your uplink to the internet.
        <strong className="text-white"> LAN</strong> is your internal management network — you will access this console via the LAN IP.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-[#5a6e80] uppercase tracking-wider mb-2">WAN Interface</label>
          <div className="flex items-center gap-2 mb-2">
            <Globe size={14} className="text-blue-400" />
            <span className="text-xs text-blue-400">Internet uplink</span>
          </div>
          {nics.length === 0 ? (
            <input
              className="w-full bg-[#0c0f14] border border-[#1a2030] rounded px-3 py-2 text-sm text-white font-mono placeholder-[#3d4d5c]"
              placeholder="e.g. ens33"
              value={form.wanName}
              onChange={e => set('wanName', e.target.value)}
            />
          ) : (
            <select
              value={form.wanName}
              onChange={e => set('wanName', e.target.value)}
              className="w-full bg-[#0c0f14] border border-[#1a2030] rounded px-3 py-2 text-sm text-white"
            >
              <option value="">— Select —</option>
              {availableForWan.map(n => (
                <option key={n.name} value={n.name}>{n.name} {n.ip_address ? `(${n.ip_address})` : '(no IP)'}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-[#5a6e80] uppercase tracking-wider mb-2">LAN Interface</label>
          <div className="flex items-center gap-2 mb-2">
            <Server size={14} className="text-purple-400" />
            <span className="text-xs text-purple-400">Management network</span>
          </div>
          {nics.length === 0 ? (
            <input
              className="w-full bg-[#0c0f14] border border-[#1a2030] rounded px-3 py-2 text-sm text-white font-mono placeholder-[#3d4d5c]"
              placeholder="e.g. ens34"
              value={form.lanName}
              onChange={e => set('lanName', e.target.value)}
            />
          ) : (
            <select
              value={form.lanName}
              onChange={e => set('lanName', e.target.value)}
              className="w-full bg-[#0c0f14] border border-[#1a2030] rounded px-3 py-2 text-sm text-white"
            >
              <option value="">— Select —</option>
              {availableForLan.map(n => (
                <option key={n.name} value={n.name}>{n.name} {n.ip_address ? `(${n.ip_address})` : '(no IP)'}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {form.wanName && form.lanName && form.wanName === form.lanName && (
        <div className="mt-4 flex items-center gap-2 text-xs text-red-400">
          <AlertTriangle size={12} /> WAN and LAN must be different interfaces.
        </div>
      )}
    </div>
  );
}

function StepWan({ form, set }: { form: WizardState; set: (k: keyof WizardState, v: string) => void }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-2">WAN Configuration</h2>
      <p className="text-[#5a6e80] text-sm mb-6">
        Configure how <strong className="text-white font-mono">{form.wanName}</strong> connects to the internet.
        Use DHCP if your ISP or upstream router assigns addresses automatically.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {(['dhcp', 'static'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => set('wanMode', mode)}
            className={`flex flex-col items-start p-4 rounded border-2 text-left transition-all ${
              form.wanMode === mode
                ? 'border-[#4caf50] bg-[#0a1f0a]'
                : 'border-[#1a2030] bg-[#0c0f14] hover:border-[#2a3040]'
            }`}
          >
            <span className="text-sm font-semibold text-white mb-1">
              {mode === 'dhcp' ? 'DHCP' : 'Static IP'}
            </span>
            <span className="text-xs text-[#5a6e80]">
              {mode === 'dhcp'
                ? 'ISP assigns address automatically'
                : 'Manually configure IP address'}
            </span>
          </button>
        ))}
      </div>

      {form.wanMode === 'static' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#5a6e80] uppercase tracking-wider mb-1">WAN IP Address</label>
            <input
              className="w-full bg-[#0c0f14] border border-[#1a2030] focus:border-[#4caf50] rounded px-3 py-2 text-sm text-white font-mono outline-none"
              placeholder="e.g. 203.0.113.10"
              value={form.wanIp}
              onChange={e => set('wanIp', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#5a6e80] uppercase tracking-wider mb-1">Subnet Mask</label>
            <select
              value={form.wanSubnet}
              onChange={e => set('wanSubnet', e.target.value)}
              className="w-full bg-[#0c0f14] border border-[#1a2030] focus:border-[#4caf50] rounded px-3 py-2 text-sm text-white outline-none"
            >
              {SUBNETS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#5a6e80] uppercase tracking-wider mb-1">Default Gateway</label>
            <input
              className="w-full bg-[#0c0f14] border border-[#1a2030] focus:border-[#4caf50] rounded px-3 py-2 text-sm text-white font-mono outline-none"
              placeholder="e.g. 203.0.113.1"
              value={form.wanGateway}
              onChange={e => set('wanGateway', e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StepLan({ form, set }: { form: WizardState; set: (k: keyof WizardState, v: string) => void }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-2">LAN Configuration</h2>
      <p className="text-[#5a6e80] text-sm mb-2">
        Set the static IP for <strong className="text-white font-mono">{form.lanName}</strong>.
        This is the management address — you will access this dashboard at this IP after setup.
      </p>

      <div className="flex items-start gap-3 bg-[#0a1520] border border-[#1a3050] rounded p-3 mb-6">
        <AlertTriangle size={14} className="text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-[#4a7fa0]">
          After clicking <strong>Finish Setup</strong>, reconnect to the management console at
          {' '}<strong className="text-white font-mono">http://{form.lanIp || '192.168.1.1'}</strong>.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#5a6e80] uppercase tracking-wider mb-1">LAN IP Address</label>
          <input
            className="w-full bg-[#0c0f14] border border-[#1a2030] focus:border-[#4caf50] rounded px-3 py-2 text-sm text-white font-mono outline-none"
            placeholder="e.g. 192.168.1.1"
            value={form.lanIp}
            onChange={e => set('lanIp', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#5a6e80] uppercase tracking-wider mb-1">Subnet Mask</label>
          <select
            value={form.lanSubnet}
            onChange={e => set('lanSubnet', e.target.value)}
            className="w-full bg-[#0c0f14] border border-[#1a2030] focus:border-[#4caf50] rounded px-3 py-2 text-sm text-white outline-none"
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
    <div>
      <h2 className="text-xl font-bold text-white mb-2">Admin Password</h2>
      <p className="text-[#5a6e80] text-sm mb-6">
        Change the default admin password. Leave blank to keep the current password
        (<span className="font-mono text-white">Admin123!</span>).
        Minimum 8 characters.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#5a6e80] uppercase tracking-wider mb-1">New Password</label>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              className="w-full bg-[#0c0f14] border border-[#1a2030] focus:border-[#4caf50] rounded px-3 py-2 pr-10 text-sm text-white outline-none"
              placeholder="Leave blank to keep current"
              value={form.adminPassword}
              onChange={e => set('adminPassword', e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShow(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3d4d5c] hover:text-white"
            >
              {show ? <Lock size={14} /> : <Lock size={14} />}
            </button>
          </div>
        </div>
        {form.adminPassword && (
          <div>
            <label className="block text-xs font-medium text-[#5a6e80] uppercase tracking-wider mb-1">Confirm Password</label>
            <input
              type={show ? 'text' : 'password'}
              className={`w-full bg-[#0c0f14] border rounded px-3 py-2 text-sm text-white outline-none ${
                mismatch ? 'border-red-500 focus:border-red-400' : 'border-[#1a2030] focus:border-[#4caf50]'
              }`}
              placeholder="Repeat new password"
              value={form.adminPasswordConfirm}
              onChange={e => set('adminPasswordConfirm', e.target.value)}
            />
            {mismatch && <p className="text-xs text-red-400 mt-1">Passwords do not match</p>}
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-[#0c0f14] border border-[#1a2030] rounded">
        <p className="text-xs text-[#5a6e80] mb-2 font-medium">Review your configuration:</p>
        <div className="space-y-1 text-xs font-mono">
          <div className="flex justify-between"><span className="text-[#3d4d5c]">WAN</span><span className="text-white">{form.wanName} — {form.wanMode.toUpperCase()}{form.wanMode === 'static' ? ` ${form.wanIp}` : ''}</span></div>
          <div className="flex justify-between"><span className="text-[#3d4d5c]">LAN</span><span className="text-white">{form.lanName} — {form.lanIp}/{form.lanSubnet}</span></div>
          <div className="flex justify-between"><span className="text-[#3d4d5c]">Password</span><span className="text-white">{form.adminPassword ? '(will be changed)' : '(keep current)'}</span></div>
        </div>
      </div>
    </div>
  );
}

function StepDone({ result }: { result: { lanIp: string; root: boolean } }) {
  return (
    <div className="text-center py-4">
      <div className="w-16 h-16 bg-[#0a1f0a] border-2 border-[#4caf50] rounded-full flex items-center justify-center mx-auto mb-4">
        <Check size={28} className="text-[#4caf50]" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Setup Complete!</h2>
      <p className="text-[#5a6e80] text-sm mb-6">
        Sonaro Gate is configured and ready. Network configuration is being applied in the background.
      </p>

      {result.root && (
        <div className="bg-[#0c0f14] border border-[#1a2030] rounded p-4 mb-4 text-left">
          <p className="text-xs text-[#5a6e80] mb-2">Management console URL (bookmark this):</p>
          <a
            href={`http://${result.lanIp}`}
            className="text-[#4caf50] font-mono text-sm hover:underline"
          >
            http://{result.lanIp}
          </a>
          <p className="text-xs text-[#3d4d5c] mt-2">
            Connect from a device on the LAN network to access the dashboard.
            If you are currently on the WAN network, reconnect via LAN first.
          </p>
        </div>
      )}

      {!result.root && (
        <div className="bg-[#1a1500] border border-[#3d2e00] rounded p-4 mb-4 text-left">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-yellow-500 mt-0.5" />
            <div>
              <p className="text-xs text-yellow-400 font-medium mb-1">Server not running as root</p>
              <p className="text-xs text-[#a08030]">
                Configuration saved to database only. To apply to the OS, restart the server with:
              </p>
              <code className="text-xs text-white font-mono bg-[#0c0f14] px-2 py-1 rounded mt-1 block">
                sudo npx tsx server/index.ts
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
