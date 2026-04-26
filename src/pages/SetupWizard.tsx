import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shell } from '@/components/layout/Shell';
import {
  Shield, ChevronRight, ChevronLeft, Check, Network, Globe,
  Server, Lock, Loader2, AlertTriangle, Wifi, Eye, EyeOff,
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
  { label: '8 (255.0.0.0)', value: '255.0.0.0' },
  { label: '16 (255.255.0.0)', value: '255.255.0.0' },
  { label: '24 (255.255.255.0)', value: '255.255.255.0' },
  { label: '25 (255.255.255.128)', value: '255.255.255.128' },
  { label: '26 (255.255.255.192)', value: '255.255.255.192' },
  { label: '27 (255.255.255.224)', value: '255.255.255.224' },
  { label: '28 (255.255.255.240)', value: '255.255.255.240' },
  { label: '30 (255.255.255.252)', value: '255.255.255.252' },
];

const STEPS = [
  { id: 1, label: 'Sonaro Gate Setup',            title: 'Welcome',                       icon: Shield },
  { id: 2, label: 'Assign Network Interfaces',    title: 'Assign Interfaces',              icon: Network },
  { id: 3, label: 'Configure WAN Interface',      title: 'WAN Configuration',              icon: Globe },
  { id: 4, label: 'Configure LAN Interface',      title: 'LAN Configuration',              icon: Server },
  { id: 5, label: 'Change Admin Account Password',title: 'Admin Password',                 icon: Lock },
  { id: 6, label: 'Wizard Completed',             title: 'Setup Complete',                 icon: Check },
];

const TOTAL = STEPS.length;

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

  const canNext2 = !!(form.wanName && form.lanName && form.wanName !== form.lanName);
  const canNext3 = form.wanMode === 'dhcp' || (!!form.wanIp && !!form.wanSubnet);
  const canNext4 = !!(form.lanIp && form.lanSubnet);
  const canNext5 =
    (!form.adminPassword && !form.adminPasswordConfirm) ||
    (form.adminPassword.length >= 8 && form.adminPassword === form.adminPasswordConfirm);

  const canGoNext =
    step === 1 ? true :
    step === 2 ? canNext2 :
    step === 3 ? canNext3 :
    step === 4 ? canNext4 :
    step === 5 ? canNext5 : false;

  const currentStep = STEPS[step - 1];
  const pct = Math.round((step / TOTAL) * 100);

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center h-64 gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-[hsl(142,70%,35%)]" />
          <span className="text-[11px] text-[#666]">Detecting network interfaces...</span>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="animate-slide-in">

        {/* Breadcrumb */}
        <div className="bg-white border-b border-[#ddd] px-4 py-2 flex items-center gap-1 text-[12px]">
          <span className="text-[#555] font-medium">Wizard</span>
          <span className="text-[#bbb] mx-1">/</span>
          <span className="text-[hsl(142,70%,35%)] font-medium">Sonaro Gate Setup</span>
          <span className="text-[#bbb] mx-1">/</span>
          <span className="text-[hsl(142,70%,35%)] font-semibold">{currentStep.label}</span>
        </div>

        {/* Progress bar */}
        <div className="bg-[#e8e8e8] border-b border-[#ccc] relative h-6 flex items-center justify-center">
          <div
            className="absolute inset-y-0 left-0 transition-all duration-300"
            style={{
              width: `${pct}%`,
              background: step === TOTAL
                ? 'hsl(142,70%,35%)'
                : 'hsl(0,72%,42%)',
            }}
          />
          <span className="relative z-10 text-[11px] font-semibold text-white drop-shadow-sm">
            Step {step} of {TOTAL}
          </span>
        </div>

        {/* Content */}
        <div className="p-4">

          {/* Section card */}
          <div className="section">
            <div className="section-header flex items-center gap-2">
              <currentStep.icon className="w-3.5 h-3.5" />
              <span>{currentStep.label}</span>
            </div>

            <div className="bg-white p-0">
              {step === 1 && <StepWelcome nics={nics} />}
              {step === 2 && <StepInterfaces nics={nics} form={form} set={set} />}
              {step === 3 && <StepWan form={form} set={set} />}
              {step === 4 && <StepLan form={form} set={set} />}
              {step === 5 && <StepPassword form={form} set={set} />}
              {step === 6 && doneResult && <StepDone result={doneResult} />}
            </div>
          </div>

          {/* Navigation buttons */}
          <div className="mt-3 flex items-center gap-2">
            {step > 1 && step < 6 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-white border border-[#ccc] hover:bg-[#f0f0f0] transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
            )}

            {step < 5 && (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canGoNext}
                className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-semibold bg-[#337ab7] hover:bg-[#2e6da4] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-3 h-3" />
                <ChevronRight className="w-3 h-3 -ml-2.5" />
                Next
              </button>
            )}

            {step === 5 && (
              <button
                onClick={handleApply}
                disabled={applying || !canNext5}
                className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-semibold bg-[hsl(142,70%,35%)] hover:bg-[hsl(142,70%,30%)] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {applying ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Applying...</>
                ) : (
                  <><Check className="w-3.5 h-3.5" /> Finish Setup</>
                )}
              </button>
            )}

            {step === 6 && (
              <button
                onClick={() => navigate('/', { replace: true })}
                className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-semibold bg-[hsl(142,70%,35%)] hover:bg-[hsl(142,70%,30%)] text-white transition-colors"
              >
                <Shield className="w-3.5 h-3.5" />
                Open Dashboard
              </button>
            )}
          </div>

        </div>
      </div>
    </Shell>
  );
}

// ─── Shared layout helpers ────────────────────────────────────────────────────

function FormRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex border-b border-[#f0f0f0] last:border-0">
      <div className="w-56 shrink-0 py-3 pr-4 text-right">
        <span className="text-[11px] font-medium text-[#444]">{label}</span>
        {hint && <p className="text-[10px] text-[#888] mt-0.5">{hint}</p>}
      </div>
      <div className="flex-1 py-2.5 pl-2 pr-4">
        {children}
      </div>
    </div>
  );
}

function DescRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex border-b border-[#f0f0f0]">
      <div className="w-56 shrink-0" />
      <div className="flex-1 py-3 pr-4 text-[11px] text-[#444]">
        {children}
      </div>
    </div>
  );
}

// ─── Step 1: Welcome ──────────────────────────────────────────────────────────

function StepWelcome({ nics }: { nics: NicInfo[] }) {
  return (
    <div>
      <DescRow>
        <p className="mb-3">
          This wizard will guide you through the initial configuration of Sonaro Gate.
          You will assign network interfaces, configure WAN and LAN addresses, and set
          the administration password.
        </p>
        <p>
          Once the wizard is complete, the management console will be accessible via the
          LAN IP address you configure.
        </p>
      </DescRow>

      <FormRow label="Detected Interfaces">
        {nics.length === 0 ? (
          <p className="text-[11px] text-[#888] py-1">
            No interfaces detected. Start server with <code className="font-mono bg-[#f5f5f5] px-1 border border-[#ddd]">sudo</code> to enable NIC detection.
          </p>
        ) : (
          <table className="w-full text-[11px] border border-[#ddd]">
            <thead className="bg-[#f5f5f5]">
              <tr>
                <th className="text-left px-2 py-1 font-medium text-[#555] border-b border-[#ddd]">Interface</th>
                <th className="text-left px-2 py-1 font-medium text-[#555] border-b border-[#ddd]">MAC Address</th>
                <th className="text-left px-2 py-1 font-medium text-[#555] border-b border-[#ddd]">IP Address</th>
                <th className="text-left px-2 py-1 font-medium text-[#555] border-b border-[#ddd]">State</th>
              </tr>
            </thead>
            <tbody>
              {nics.map(n => (
                <tr key={n.id} className="border-b border-[#f0f0f0] last:border-0">
                  <td className="px-2 py-1 font-mono text-[#333]">{n.name}</td>
                  <td className="px-2 py-1 font-mono text-[#666]">{n.mac ?? 'n/a'}</td>
                  <td className="px-2 py-1 font-mono text-[#333]">{n.ip_address ?? 'no IP'}</td>
                  <td className="px-2 py-1">
                    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 uppercase ${
                      n.status === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
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
      </FormRow>

      <FormRow label="Important">
        <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
          <p>
            After setup, connect to the management console via the <strong>LAN IP address</strong>,
            not the WAN address. This ensures changes to WAN settings never disconnect you from
            the management interface.
          </p>
        </div>
      </FormRow>
    </div>
  );
}

// ─── Step 2: Interface Assignment ────────────────────────────────────────────

function StepInterfaces({ nics, form, set }: {
  nics: NicInfo[];
  form: WizardState;
  set: (k: keyof WizardState, v: string) => void;
}) {
  const availableForWan = nics.filter(n => n.name !== form.lanName);
  const availableForLan = nics.filter(n => n.name !== form.wanName);

  return (
    <div>
      <DescRow>
        <p>
          Assign each physical network adapter to a role. The <strong>WAN</strong> interface
          is the uplink to the internet or upstream router. The <strong>LAN</strong> interface
          is the internal management network — you will access this console via the LAN IP address.
        </p>
      </DescRow>

      <FormRow label="WAN Interface" hint="Internet uplink">
        {nics.length === 0 ? (
          <input
            className="forti-input w-full font-mono"
            placeholder="e.g. eth0"
            value={form.wanName}
            onChange={e => set('wanName', e.target.value)}
          />
        ) : (
          <select
            value={form.wanName}
            onChange={e => set('wanName', e.target.value)}
            className="forti-select"
            style={{ width: 280 }}
          >
            <option value="">Select interface...</option>
            {availableForWan.map(n => (
              <option key={n.name} value={n.name}>
                {n.name}{n.ip_address ? ` (${n.ip_address})` : ' (no IP)'}
              </option>
            ))}
          </select>
        )}
      </FormRow>

      <FormRow label="LAN Interface" hint="Management network">
        {nics.length === 0 ? (
          <input
            className="forti-input w-full font-mono"
            placeholder="e.g. eth1"
            value={form.lanName}
            onChange={e => set('lanName', e.target.value)}
          />
        ) : (
          <select
            value={form.lanName}
            onChange={e => set('lanName', e.target.value)}
            className="forti-select"
            style={{ width: 280 }}
          >
            <option value="">Select interface...</option>
            {availableForLan.map(n => (
              <option key={n.name} value={n.name}>
                {n.name}{n.ip_address ? ` (${n.ip_address})` : ' (no IP)'}
              </option>
            ))}
          </select>
        )}
      </FormRow>

      {form.wanName && form.lanName && form.wanName === form.lanName && (
        <DescRow>
          <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 text-[11px] text-red-700">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            WAN and LAN must be assigned to different interfaces.
          </div>
        </DescRow>
      )}

      {form.wanName && form.lanName && form.wanName !== form.lanName && (
        <DescRow>
          <div className="p-2 bg-[#f0f8f0] border border-[#c3e0c3] text-[11px] text-[#2d6e2d]">
            WAN: <strong className="font-mono">{form.wanName}</strong>
            {' '}(internet uplink) and LAN: <strong className="font-mono">{form.lanName}</strong>
            {' '}(management) are ready.
          </div>
        </DescRow>
      )}
    </div>
  );
}

// ─── Step 3: WAN Configuration ───────────────────────────────────────────────

function StepWan({ form, set }: { form: WizardState; set: (k: keyof WizardState, v: string) => void }) {
  return (
    <div>
      <DescRow>
        <p>
          On this screen the WAN interface <strong className="font-mono">{form.wanName || 'WAN'}</strong> will
          be configured. Select DHCP if your ISP assigns an IP address automatically, or Static
          IP to enter the address manually.
        </p>
      </DescRow>

      <FormRow label="IP Address Type">
        <div className="flex gap-3">
          {(['dhcp', 'static'] as const).map(mode => (
            <label
              key={mode}
              className="flex items-center gap-2 cursor-pointer text-[11px]"
            >
              <input
                type="radio"
                name="wanMode"
                value={mode}
                checked={form.wanMode === mode}
                onChange={() => set('wanMode', mode)}
                className="accent-[hsl(142,70%,35%)]"
              />
              <span className="font-medium">
                {mode === 'dhcp' ? 'DHCP (automatic)' : 'Static IP'}
              </span>
            </label>
          ))}
        </div>
        {form.wanMode === 'dhcp' && (
          <p className="text-[10px] text-[#888] mt-1">
            The IP address will be assigned automatically by your ISP or upstream router.
          </p>
        )}
      </FormRow>

      {form.wanMode === 'static' && (
        <>
          <FormRow label="WAN IP Address">
            <input
              className="forti-input font-mono"
              style={{ width: 220 }}
              placeholder="e.g. 203.0.113.10"
              value={form.wanIp}
              onChange={e => set('wanIp', e.target.value)}
            />
          </FormRow>

          <FormRow label="Subnet Bit Count" hint="CIDR prefix length">
            <select
              value={form.wanSubnet}
              onChange={e => set('wanSubnet', e.target.value)}
              className="forti-select"
              style={{ width: 220 }}
            >
              {SUBNETS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </FormRow>

          <FormRow label="Default Gateway" hint="Optional">
            <input
              className="forti-input font-mono"
              style={{ width: 220 }}
              placeholder="e.g. 203.0.113.1"
              value={form.wanGateway}
              onChange={e => set('wanGateway', e.target.value)}
            />
          </FormRow>
        </>
      )}
    </div>
  );
}

// ─── Step 4: LAN Configuration ───────────────────────────────────────────────

function StepLan({ form, set }: { form: WizardState; set: (k: keyof WizardState, v: string) => void }) {
  return (
    <div>
      <DescRow>
        <p>
          On this screen the Local Area Network information will be configured.
          Set a static IP address for <strong className="font-mono">{form.lanName || 'LAN'}</strong> — this
          will be the management address for this console after setup.
        </p>
        <p className="mt-2 text-[#666]">
          Type <code className="font-mono bg-[#f5f5f5] border border-[#ddd] px-0.5">dhcp</code> in
          the IP Address field if this interface uses DHCP to obtain its address.
        </p>
      </DescRow>

      <FormRow label="LAN IP Address">
        <input
          className="forti-input font-mono"
          style={{ width: 220 }}
          placeholder="e.g. 192.168.1.1"
          value={form.lanIp}
          onChange={e => set('lanIp', e.target.value)}
        />
        <p className="text-[10px] text-[#888] mt-1">
          After Finish Setup, connect to:{' '}
          <span className="font-mono font-medium text-[#333]">http://{form.lanIp || '192.168.1.1'}</span>
        </p>
      </FormRow>

      <FormRow label="Subnet Bit Count">
        <select
          value={form.lanSubnet}
          onChange={e => set('lanSubnet', e.target.value)}
          className="forti-select"
          style={{ width: 220 }}
        >
          {SUBNETS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </FormRow>
    </div>
  );
}

// ─── Step 5: Admin Password ───────────────────────────────────────────────────

function StepPassword({ form, set }: { form: WizardState; set: (k: keyof WizardState, v: string) => void }) {
  const [show, setShow] = useState(false);
  const mismatch = !!(form.adminPassword && form.adminPasswordConfirm && form.adminPassword !== form.adminPasswordConfirm);

  return (
    <div>
      <DescRow>
        <p>
          Change the password for the admin account.
        </p>
        <p className="mt-1 text-[#666]">
          This account is used to access the GUI and console. Leave blank to keep the
          current password (<code className="font-mono bg-[#f5f5f5] border border-[#ddd] px-0.5">Admin123!</code>).
          Minimum 8 characters.
        </p>
      </DescRow>

      <FormRow label="New Admin Password">
        <div className="flex items-center gap-1">
          <input
            type={show ? 'text' : 'password'}
            className="forti-input font-mono"
            style={{ width: 280 }}
            placeholder="Leave blank to keep current"
            value={form.adminPassword}
            onChange={e => set('adminPassword', e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShow(v => !v)}
            className="forti-toolbar-btn px-1.5"
            title={show ? 'Hide' : 'Show'}
          >
            {show ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
        </div>
      </FormRow>

      <FormRow label="Confirm Admin Password">
        <div>
          <input
            type={show ? 'text' : 'password'}
            className={`forti-input font-mono ${mismatch ? 'border-red-400 focus:border-red-500' : ''}`}
            style={{ width: 280 }}
            placeholder="Repeat new password"
            value={form.adminPasswordConfirm}
            onChange={e => set('adminPasswordConfirm', e.target.value)}
            disabled={!form.adminPassword}
          />
          {mismatch && (
            <p className="text-[11px] text-red-600 mt-1">Passwords do not match.</p>
          )}
        </div>
      </FormRow>

      <DescRow>
        <div className="border border-[#ddd] bg-[#fafafa] p-3 text-[11px]">
          <p className="font-medium text-[#333] mb-2">Configuration summary:</p>
          <div className="space-y-1 font-mono text-[#555]">
            <div>
              <span className="text-[#888] not-italic" style={{ fontFamily: 'inherit', fontWeight: 400 }}>WAN: </span>
              {form.wanName} ({form.wanMode.toUpperCase()}
              {form.wanMode === 'static' && form.wanIp ? ` ${form.wanIp}` : ''})
            </div>
            <div>
              <span className="text-[#888] not-italic" style={{ fontFamily: 'inherit', fontWeight: 400 }}>LAN: </span>
              {form.lanName} {form.lanIp}/{form.lanSubnet}
            </div>
            <div>
              <span className="text-[#888] not-italic" style={{ fontFamily: 'inherit', fontWeight: 400 }}>Password: </span>
              <span style={{ fontFamily: 'inherit' }}>{form.adminPassword ? 'will be changed' : 'keep current'}</span>
            </div>
          </div>
        </div>
      </DescRow>
    </div>
  );
}

// ─── Step 6: Done ────────────────────────────────────────────────────────────

function StepDone({ result }: { result: { lanIp: string; root: boolean } }) {
  return (
    <div>
      <DescRow>
        <div className="space-y-4">
          <div>
            <p className="font-semibold text-[#222] text-[13px] mb-1">
              Congratulations! Sonaro Gate is now configured.
            </p>
            <p className="text-[11px] text-[#555]">
              The firewall management console is ready. Connect a device to the LAN network
              and open the management URL below.
            </p>
          </div>

          <div className="border border-[#ddd] bg-[#f9f9f9] p-3 text-[11px] space-y-2">
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-[hsl(142,70%,35%)] shrink-0" />
              <span className="text-[#888]">Management URL:</span>
              <a
                href={`http://${result.lanIp}`}
                className="font-mono font-medium text-[hsl(142,70%,35%)] hover:underline"
              >
                http://{result.lanIp}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-[#888] shrink-0" />
              <span className="text-[#888]">Login:</span>
              <span className="font-mono">admin@sonaro.local</span>
            </div>
          </div>

          {!result.root && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
              <p>
                The server is not running as root. Network interface settings were saved to
                the database but IP addresses were not applied to the system. Run with{' '}
                <code className="font-mono bg-amber-100 px-0.5">sudo</code> on production hardware.
              </p>
            </div>
          )}
        </div>
      </DescRow>
    </div>
  );
}
