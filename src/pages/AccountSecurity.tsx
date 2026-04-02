/**
 * Sonaro Gate — Account Security / MFA Management
 * Copyright (c) 2025 Huỳnh Chí Trung (0xDragon)
 * SPDX-License-Identifier: MIT
 */

import { useState, useEffect } from 'react';
import { Shell } from '@/components/layout/Shell';
import { mfaApi } from '@/lib/postgrest';
import { useAuth } from '@/contexts/AuthContext';
import {
  ShieldCheck, ShieldOff, Smartphone, Copy,
  Eye, EyeOff, CheckCircle, AlertTriangle, Lock, Key,
  ChevronLeft, TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';

type MfaView = 'status' | 'setup-qr' | 'setup-verify' | 'disable';

export default function AccountSecurity() {
  const { user, session } = useAuth();
  const [view, setView]             = useState<MfaView>('status');
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading]       = useState(true);

  const [qrData, setQrData]         = useState<{ secret: string; qr: string } | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [setupCode, setSetupCode]   = useState('');
  const [setupLoading, setSetupLoading] = useState(false);

  const [disablePass, setDisablePass]           = useState('');
  const [showDisablePass, setShowDisablePass]   = useState(false);
  const [disableLoading, setDisableLoading]     = useState(false);

  const [cpCurrent, setCpCurrent]         = useState('');
  const [cpNew, setCpNew]                 = useState('');
  const [cpConfirm, setCpConfirm]         = useState('');
  const [cpLoading, setCpLoading]         = useState(false);
  const [showCpCurrent, setShowCpCurrent] = useState(false);
  const [showCpNew, setShowCpNew]         = useState(false);
  const [showCpConfirm, setShowCpConfirm] = useState(false);

  const isMock = !session?.token || session.token === 'mock-jwt-token';

  useEffect(() => {
    if (isMock) { setLoading(false); return; }
    mfaApi.getStatus().then(s => {
      setMfaEnabled(s.mfa_enabled);
      setLoading(false);
    });
  }, [isMock]);

  const handleSetup = async () => {
    if (isMock) { toast.error('MFA setup requires a real database connection.'); return; }
    setSetupLoading(true);
    const data = await mfaApi.setup();
    setSetupLoading(false);
    if (!data) { toast.error('Failed to generate MFA setup. Try again.'); return; }
    setQrData({ secret: data.secret, qr: data.qr });
    setSetupCode('');
    setView('setup-qr');
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setupCode.length !== 6) return;
    setSetupLoading(true);
    const result = await mfaApi.confirm(setupCode);
    setSetupLoading(false);
    if (!result.success) {
      toast.error(result.error || 'Invalid code. Try again.');
      setSetupCode('');
      return;
    }
    setMfaEnabled(true);
    setView('status');
    setQrData(null);
    toast.success('Two-factor authentication is now enabled.');
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disablePass) return;
    setDisableLoading(true);
    const result = await mfaApi.disable(disablePass);
    setDisableLoading(false);
    if (!result.success) {
      toast.error(result.error || 'Failed to disable MFA.');
      setDisablePass('');
      return;
    }
    setMfaEnabled(false);
    setView('status');
    setDisablePass('');
    toast.success('Two-factor authentication has been disabled.');
  };

  const copySecret = () => {
    if (qrData) { navigator.clipboard.writeText(qrData.secret); toast.success('Secret copied to clipboard.'); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isMock) { toast.error('Requires a real database connection.'); return; }
    if (cpNew.length < 8) { toast.error('New password must be at least 8 characters.'); return; }
    if (cpNew !== cpConfirm) { toast.error('New passwords do not match.'); return; }
    if (cpNew === cpCurrent) { toast.error('New password must differ from the current password.'); return; }
    setCpLoading(true);
    const result = await mfaApi.changePassword(cpCurrent, cpNew);
    setCpLoading(false);
    if (!result.success) { toast.error(result.error || 'Failed to change password.'); return; }
    toast.success('Password changed successfully.');
    setCpCurrent(''); setCpNew(''); setCpConfirm('');
  };

  const pwStrength = cpNew.length === 0 ? 0 : cpNew.length < 8 ? 1 : cpNew.length < 12 ? 2 : 3;
  const pwStrengthLabel = ['', 'Too short', 'Fair', 'Strong'];
  const pwStrengthColor = ['', '#d97706', '#2563eb', '#16a34a'];

  return (
    <Shell>
      <div className="space-y-0">

        {/* ── Page Header ─────────────────────────────────── */}
        <div className="section-header-neutral">
          <div className="flex items-center gap-2">
            <ShieldCheck size={13} />
            <span className="font-semibold">Account Security</span>
            <span className="text-[10px] text-[#888]">—</span>
            <span className="text-[10px] text-[#666] font-normal">{user?.email}</span>
          </div>
        </div>

        {/* ── Toolbar ──────────────────────────────────────── */}
        <div className="forti-toolbar">
          {view !== 'status' && (
            <button className="forti-toolbar-btn" onClick={() => { setView('status'); setQrData(null); setDisablePass(''); }}>
              <ChevronLeft size={12} />
              <span>Back</span>
            </button>
          )}
          <div className="flex-1" />
          <span className="text-[10px] text-[#888] pr-2">
            {view === 'status' && 'Account Security Settings'}
            {view === 'setup-qr' && 'Step 1 of 2 — Scan QR Code'}
            {view === 'setup-verify' && 'Step 2 of 2 — Verify Code'}
            {view === 'disable' && 'Disable Two-Factor Authentication'}
          </span>
        </div>

        <div className="p-4 space-y-3">

          {/* ── Demo mode banner ───────────────────────────── */}
          {isMock && (
            <div className="flex items-start gap-2 px-3 py-2 bg-[#fffbeb] border border-[#fbbf24] text-[11px]">
              <TriangleAlert size={12} className="text-[#d97706] mt-0.5 shrink-0" />
              <span className="text-[#92400e]">
                Demo mode — MFA and password change require a real PostgreSQL connection.
              </span>
            </div>
          )}

          {/* ════════════════════════════════════════════════
              VIEW: STATUS
          ════════════════════════════════════════════════ */}
          {view === 'status' && (
            <>
              {/* MFA Card */}
              <div className="bg-white border border-[#ddd]">
                <div className="section-header-neutral">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={12} />
                    <span>Two-Factor Authentication (TOTP)</span>
                  </div>
                </div>

                <div className="p-3">
                  {loading ? (
                    <p className="text-[11px] text-[#999] py-2">Loading…</p>
                  ) : (
                    <table className="w-full text-[11px]">
                      <tbody>
                        <tr className="border-b border-[#eee]">
                          <td className="py-2 pr-4 text-[#666] w-40">Status</td>
                          <td className="py-2">
                            {mfaEnabled ? (
                              <span className="inline-flex items-center gap-1.5 text-[#16a34a] font-semibold">
                                <ShieldCheck size={12} />
                                Enabled
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[#6b7280]">
                                <ShieldOff size={12} />
                                Disabled
                              </span>
                            )}
                          </td>
                        </tr>
                        <tr className="border-b border-[#eee]">
                          <td className="py-2 pr-4 text-[#666]">Method</td>
                          <td className="py-2 text-[#333]">
                            <span className="inline-flex items-center gap-1.5">
                              <Smartphone size={11} />
                              Time-based OTP (TOTP)
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 pr-4 text-[#666]">Compatible Apps</td>
                          <td className="py-2 text-[#555]">Google Authenticator, Authy, 1Password, Bitwarden</td>
                        </tr>
                      </tbody>
                    </table>
                  )}

                  {!loading && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#eee]">
                      {mfaEnabled ? (
                        <>
                          <span className="flex items-center gap-1.5 text-[11px] text-[#16a34a] flex-1">
                            <CheckCircle size={11} />
                            Your account is protected with two-factor authentication.
                          </span>
                          <button
                            data-testid="button-mfa-disable-start"
                            disabled={isMock}
                            onClick={() => { setView('disable'); setDisablePass(''); }}
                            className="forti-toolbar-btn text-red-700 border-red-300 hover:bg-red-50"
                          >
                            <ShieldOff size={11} />
                            <span>Disable MFA</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-[11px] text-[#888] flex-1">
                            No second factor is required at login.
                          </span>
                          <button
                            data-testid="button-mfa-enable-start"
                            disabled={isMock || setupLoading}
                            onClick={handleSetup}
                            className="forti-toolbar-btn primary"
                          >
                            <Smartphone size={11} />
                            <span>{setupLoading ? 'Generating…' : 'Set Up Two-Factor Authentication'}</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Change Password Card */}
              <div className="bg-white border border-[#ddd]">
                <div className="section-header-neutral">
                  <div className="flex items-center gap-1.5">
                    <Key size={12} />
                    <span>Change Password</span>
                  </div>
                </div>

                <form onSubmit={handleChangePassword} className="p-3">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Current password */}
                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold text-[#555] uppercase tracking-wide mb-1">
                        Current Password
                      </label>
                      <div className="relative">
                        <Lock size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#aaa] pointer-events-none" />
                        <input
                          data-testid="input-cp-current"
                          type={showCpCurrent ? 'text' : 'password'}
                          value={cpCurrent}
                          onChange={e => setCpCurrent(e.target.value)}
                          placeholder="Enter current password"
                          autoComplete="current-password"
                          disabled={isMock}
                          className="forti-input w-full pl-7 pr-7"
                        />
                        <button type="button" onClick={() => setShowCpCurrent(v => !v)} tabIndex={-1}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#aaa] hover:text-[#555] bg-transparent border-0 cursor-pointer p-0">
                          {showCpCurrent ? <EyeOff size={11} /> : <Eye size={11} />}
                        </button>
                      </div>
                    </div>

                    {/* New password */}
                    <div>
                      <label className="block text-[10px] font-semibold text-[#555] uppercase tracking-wide mb-1">
                        New Password
                      </label>
                      <div className="relative">
                        <Lock size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#aaa] pointer-events-none" />
                        <input
                          data-testid="input-cp-new"
                          type={showCpNew ? 'text' : 'password'}
                          value={cpNew}
                          onChange={e => setCpNew(e.target.value)}
                          placeholder="Min 8 characters"
                          autoComplete="new-password"
                          disabled={isMock}
                          className="forti-input w-full pl-7 pr-7"
                        />
                        <button type="button" onClick={() => setShowCpNew(v => !v)} tabIndex={-1}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#aaa] hover:text-[#555] bg-transparent border-0 cursor-pointer p-0">
                          {showCpNew ? <EyeOff size={11} /> : <Eye size={11} />}
                        </button>
                      </div>
                      {cpNew.length > 0 && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <div className="flex gap-0.5">
                            {[1, 2, 3].map(i => (
                              <div key={i} style={{ width: 24, height: 3, borderRadius: 1, background: pwStrength >= i ? pwStrengthColor[pwStrength] : '#ddd' }} />
                            ))}
                          </div>
                          <span style={{ fontSize: 10, color: pwStrengthColor[pwStrength] }}>{pwStrengthLabel[pwStrength]}</span>
                        </div>
                      )}
                    </div>

                    {/* Confirm */}
                    <div>
                      <label className="block text-[10px] font-semibold text-[#555] uppercase tracking-wide mb-1">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <Lock size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#aaa] pointer-events-none" />
                        <input
                          data-testid="input-cp-confirm"
                          type={showCpConfirm ? 'text' : 'password'}
                          value={cpConfirm}
                          onChange={e => setCpConfirm(e.target.value)}
                          placeholder="Repeat new password"
                          autoComplete="new-password"
                          disabled={isMock}
                          className={`forti-input w-full pl-7 pr-7 ${cpConfirm && cpConfirm !== cpNew ? 'border-red-400 focus:border-red-500' : ''}`}
                        />
                        <button type="button" onClick={() => setShowCpConfirm(v => !v)} tabIndex={-1}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#aaa] hover:text-[#555] bg-transparent border-0 cursor-pointer p-0">
                          {showCpConfirm ? <EyeOff size={11} /> : <Eye size={11} />}
                        </button>
                      </div>
                      {cpConfirm && cpConfirm !== cpNew && (
                        <p className="text-[10px] text-red-500 mt-1">Passwords do not match</p>
                      )}
                      {cpConfirm && cpConfirm === cpNew && cpNew.length >= 8 && (
                        <p className="text-[10px] text-green-600 mt-1 flex items-center gap-1">
                          <CheckCircle size={10} /> Passwords match
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#eee]">
                    <button
                      data-testid="button-change-password-submit"
                      type="submit"
                      disabled={isMock || cpLoading || !cpCurrent || cpNew.length < 8 || cpNew !== cpConfirm}
                      className="forti-toolbar-btn primary"
                    >
                      <Key size={11} />
                      <span>{cpLoading ? 'Changing…' : 'Apply New Password'}</span>
                    </button>
                    <button type="button" className="forti-toolbar-btn" onClick={() => { setCpCurrent(''); setCpNew(''); setCpConfirm(''); }}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}

          {/* ════════════════════════════════════════════════
              VIEW: SETUP — QR
          ════════════════════════════════════════════════ */}
          {view === 'setup-qr' && qrData && (
            <div className="bg-white border border-[#ddd]">
              <div className="section-header-neutral">
                <div className="flex items-center gap-1.5">
                  <Smartphone size={12} />
                  <span>Step 1 of 2 — Scan QR Code</span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex gap-6 items-start">
                  {/* QR code */}
                  <div className="shrink-0 p-2 border border-[#ddd] bg-white">
                    <img src={qrData.qr} alt="TOTP QR Code" width={160} height={160} />
                  </div>

                  <div className="flex-1 space-y-3">
                    <p className="text-[11px] text-[#555]">
                      Open your authenticator app (Google Authenticator, Authy, or 1Password) and scan the QR code on the left.
                    </p>

                    <div>
                      <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wide mb-1">Manual Entry Key</p>
                      <div className="flex items-center gap-1 bg-[#f5f5f5] border border-[#ddd] px-2 py-1.5">
                        <code className="flex-1 text-[11px] font-mono text-[#333] tracking-widest break-all">
                          {showSecret ? qrData.secret : qrData.secret.replace(/./g, '•')}
                        </code>
                        <button type="button" onClick={() => setShowSecret(v => !v)} className="forti-toolbar-btn px-1.5 py-0.5">
                          {showSecret ? <EyeOff size={11} /> : <Eye size={11} />}
                        </button>
                        <button type="button" onClick={copySecret} className="forti-toolbar-btn px-1.5 py-0.5">
                          <Copy size={11} />
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setView('setup-verify')}
                        className="forti-toolbar-btn primary"
                      >
                        <CheckCircle size={11} />
                        <span>I've Scanned It — Continue</span>
                      </button>
                      <button onClick={() => { setView('status'); setQrData(null); }} className="forti-toolbar-btn">
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════
              VIEW: SETUP — VERIFY
          ════════════════════════════════════════════════ */}
          {view === 'setup-verify' && (
            <div className="bg-white border border-[#ddd]">
              <div className="section-header-neutral">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={12} />
                  <span>Step 2 of 2 — Verify Authentication Code</span>
                </div>
              </div>
              <form onSubmit={handleConfirm} className="p-4 max-w-sm">
                <p className="text-[11px] text-[#555] mb-3">
                  Enter the 6-digit code displayed in your authenticator app to confirm setup.
                </p>
                <div className="mb-3">
                  <label className="block text-[10px] font-semibold text-[#555] uppercase tracking-wide mb-1">
                    Authentication Code
                  </label>
                  <input
                    data-testid="input-setup-mfa-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    value={setupCode}
                    onChange={e => setSetupCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    placeholder="000 000"
                    maxLength={6}
                    className="forti-input w-full text-center text-lg font-bold tracking-[0.4em]"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    data-testid="button-mfa-setup-confirm"
                    type="submit"
                    disabled={setupCode.length !== 6 || setupLoading}
                    className="forti-toolbar-btn primary"
                  >
                    <ShieldCheck size={11} />
                    <span>{setupLoading ? 'Verifying…' : 'Enable Two-Factor Authentication'}</span>
                  </button>
                  <button type="button" onClick={() => setView('setup-qr')} className="forti-toolbar-btn">
                    Back
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ════════════════════════════════════════════════
              VIEW: DISABLE
          ════════════════════════════════════════════════ */}
          {view === 'disable' && (
            <div className="bg-white border border-[#ddd]">
              <div className="section-header-neutral">
                <div className="flex items-center gap-1.5">
                  <ShieldOff size={12} />
                  <span>Disable Two-Factor Authentication</span>
                </div>
              </div>
              <form onSubmit={handleDisable} className="p-4 max-w-sm space-y-3">
                <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 text-[11px]">
                  <AlertTriangle size={11} className="text-red-500 mt-0.5 shrink-0" />
                  <span className="text-red-700">
                    Disabling MFA reduces account security. Anyone with your password can sign in.
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#555] uppercase tracking-wide mb-1">
                    Confirm Current Password
                  </label>
                  <div className="relative">
                    <Lock size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#aaa] pointer-events-none" />
                    <input
                      data-testid="input-disable-mfa-password"
                      type={showDisablePass ? 'text' : 'password'}
                      value={disablePass}
                      onChange={e => setDisablePass(e.target.value)}
                      placeholder="Current password"
                      autoFocus
                      className="forti-input w-full pl-7 pr-7"
                    />
                    <button type="button" onClick={() => setShowDisablePass(v => !v)} tabIndex={-1}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#aaa] hover:text-[#555] bg-transparent border-0 cursor-pointer p-0">
                      {showDisablePass ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    data-testid="button-mfa-disable-confirm"
                    type="submit"
                    disabled={!disablePass || disableLoading}
                    className="forti-toolbar-btn text-red-700 border-red-300 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <ShieldOff size={11} />
                    <span>{disableLoading ? 'Disabling…' : 'Disable Two-Factor Authentication'}</span>
                  </button>
                  <button type="button" onClick={() => setView('status')} className="forti-toolbar-btn">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </Shell>
  );
}
