/**
 * Sonaro Gate — Account Security / MFA Management
 * Copyright (c) 2025 Huỳnh Chí Trung (0xDragon)
 * SPDX-License-Identifier: MIT
 */

import { useState, useEffect } from 'react';
import { Shell } from '@/components/layout/Shell';
import { mfaApi } from '@/lib/postgrest';
import { useAuth } from '@/contexts/AuthContext';
import { ShieldCheck, ShieldOff, Smartphone, Copy, Eye, EyeOff, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { toast } from 'sonner';

type MfaView = 'status' | 'setup-qr' | 'setup-verify' | 'disable';

const C = {
  surface:   '#161b22',
  surfaceHdr: '#0d1117',
  border:    '#21262d',
  borderFocus: '#3fb950',
  textPrimary: '#e6edf3',
  textSub:   '#7d8590',
  textMuted: '#484f58',
  greenAccent: '#3fb950',
  green:     '#1c6e30',
  greenHover: '#217a36',
  red:       '#b91c1c',
  pageBg:    '#0d1117',
};

export default function AccountSecurity() {
  const { user, session } = useAuth();
  const [view, setView]             = useState<MfaView>('status');
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading]       = useState(true);

  const [qrData, setQrData]         = useState<{ secret: string; qr: string } | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [setupCode, setSetupCode]   = useState('');
  const [setupFocus, setSetupFocus] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);

  const [disablePass, setDisablePass]     = useState('');
  const [disableFocus, setDisableFocus]   = useState(false);
  const [showDisablePass, setShowDisablePass] = useState(false);
  const [disableLoading, setDisableLoading] = useState(false);

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

  const inputStyle = (focus: boolean): React.CSSProperties => ({
    width: '100%', boxSizing: 'border-box',
    padding: '10px 12px 10px 38px',
    fontSize: 13, color: C.textPrimary,
    background: C.pageBg,
    border: `1px solid ${focus ? C.borderFocus : C.border}`,
    borderRadius: 5, outline: 'none',
    transition: 'border-color 0.15s',
  });

  return (
    <Shell title="Account Security">
      <div style={{ maxWidth: 560, margin: '32px auto', padding: '0 16px' }}>

        {/* ── Header ─────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, margin: 0 }}>Account Security</h2>
          <p style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>
            Manage two-factor authentication for{' '}
            <span style={{ color: C.textPrimary }}>{user?.email}</span>
          </p>
        </div>

        {isMock && (
          <div style={{ background: '#1c2030', border: `1px solid #334155`, borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertCircle style={{ width: 14, height: 14, color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
              Running in demo mode. MFA setup requires a real database. Connect a PostgreSQL instance to enable this feature.
            </p>
          </div>
        )}

        {/* ── Status card ─────────────────────────────────── */}
        {view === 'status' && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}`, background: C.surfaceHdr }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, margin: 0 }}>Two-Factor Authentication (TOTP)</p>
              <p style={{ fontSize: 11, color: C.textSub, margin: '3px 0 0' }}>
                Use an authenticator app (Google Authenticator, Authy, 1Password) to generate time-based codes.
              </p>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {loading ? (
                <p style={{ fontSize: 12, color: C.textSub }}>Loading…</p>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 8,
                      background: mfaEnabled ? 'rgba(63,185,80,0.1)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${mfaEnabled ? 'rgba(63,185,80,0.3)' : C.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {mfaEnabled
                        ? <ShieldCheck style={{ width: 18, height: 18, color: C.greenAccent }} />
                        : <ShieldOff style={{ width: 18, height: 18, color: C.textMuted }} />}
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, margin: 0 }}>
                        {mfaEnabled ? 'Enabled' : 'Disabled'}
                      </p>
                      <p style={{ fontSize: 11, color: C.textSub, margin: '2px 0 0' }}>
                        {mfaEnabled ? 'Your account requires a code at every login.' : 'No second factor is required at login.'}
                      </p>
                    </div>
                  </div>

                  {mfaEnabled ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 6, background: 'rgba(63,185,80,0.06)', border: '1px solid rgba(63,185,80,0.2)' }}>
                        <CheckCircle2 style={{ width: 13, height: 13, color: C.greenAccent, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: C.textSub }}>Your account is protected with TOTP two-factor authentication.</span>
                      </div>
                      <button
                        data-testid="button-mfa-disable-start"
                        disabled={isMock}
                        onClick={() => { setView('disable'); setDisablePass(''); }}
                        style={{ alignSelf: 'flex-start', padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#fff', background: C.red, border: `1px solid ${C.red}`, borderRadius: 5, cursor: isMock ? 'not-allowed' : 'pointer', opacity: isMock ? 0.5 : 1 }}
                      >
                        Disable MFA
                      </button>
                    </div>
                  ) : (
                    <button
                      data-testid="button-mfa-enable-start"
                      disabled={isMock || setupLoading}
                      onClick={handleSetup}
                      style={{ padding: '9px 18px', fontSize: 12, fontWeight: 700, color: '#fff', background: C.green, border: `1px solid ${C.green}`, borderRadius: 5, cursor: (isMock || setupLoading) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 7, opacity: isMock ? 0.5 : 1 }}
                    >
                      <Smartphone style={{ width: 13, height: 13 }} />
                      {setupLoading ? 'Generating…' : 'Set Up Two-Factor Authentication'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Setup: QR code ──────────────────────────────── */}
        {view === 'setup-qr' && qrData && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}`, background: C.surfaceHdr }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, margin: 0 }}>Step 1 — Scan QR Code</p>
              <p style={{ fontSize: 11, color: C.textSub, margin: '3px 0 0' }}>Open your authenticator app and scan this QR code.</p>
            </div>
            <div style={{ padding: '24px' }}>

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <div style={{ padding: 12, background: '#ffffff', borderRadius: 8, border: `1px solid ${C.border}` }}>
                  <img src={qrData.qr} alt="TOTP QR Code" width={180} height={180} />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, color: C.textSub, marginBottom: 8 }}>
                  Can't scan? Enter this secret key manually:
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.pageBg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px' }}>
                  <code style={{ flex: 1, fontSize: 12, letterSpacing: '0.1em', color: C.textPrimary, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {showSecret ? qrData.secret : qrData.secret.replace(/./g, '•')}
                  </code>
                  <button type="button" onClick={() => setShowSecret(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 4 }}>
                    {showSecret ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
                  </button>
                  <button type="button" onClick={copySecret} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 4 }}>
                    <Copy style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setView('setup-verify')}
                  style={{ flex: 1, padding: '10px 16px', fontSize: 12, fontWeight: 700, color: '#fff', background: C.green, border: `1px solid ${C.green}`, borderRadius: 5, cursor: 'pointer' }}
                >
                  I've scanned it — Continue
                </button>
                <button
                  onClick={() => { setView('status'); setQrData(null); }}
                  style={{ padding: '10px 16px', fontSize: 12, color: C.textSub, background: 'none', border: `1px solid ${C.border}`, borderRadius: 5, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Setup: Verify code ──────────────────────────── */}
        {view === 'setup-verify' && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}`, background: C.surfaceHdr }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, margin: 0 }}>Step 2 — Verify Code</p>
              <p style={{ fontSize: 11, color: C.textSub, margin: '3px 0 0' }}>Enter the 6-digit code shown in your authenticator app to confirm setup.</p>
            </div>
            <form onSubmit={handleConfirm} style={{ padding: '24px' }}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textSub, marginBottom: 7 }}>
                  Authentication Code
                </label>
                <div style={{ position: 'relative' }}>
                  <ShieldCheck style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: C.textMuted, pointerEvents: 'none' }} />
                  <input
                    data-testid="input-setup-mfa-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    value={setupCode}
                    onChange={e => setSetupCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    onFocus={() => setSetupFocus(true)}
                    onBlur={() => setSetupFocus(false)}
                    placeholder="000000"
                    maxLength={6}
                    style={{ ...inputStyle(setupFocus), fontSize: 20, fontWeight: 700, letterSpacing: '0.3em', textAlign: 'center' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  data-testid="button-mfa-setup-confirm"
                  type="submit"
                  disabled={setupCode.length !== 6 || setupLoading}
                  style={{ flex: 1, padding: '10px 16px', fontSize: 12, fontWeight: 700, color: '#fff', background: C.green, border: `1px solid ${C.green}`, borderRadius: 5, cursor: (setupCode.length !== 6 || setupLoading) ? 'not-allowed' : 'pointer', opacity: (setupCode.length !== 6 || setupLoading) ? 0.6 : 1 }}
                >
                  {setupLoading ? 'Verifying…' : 'Enable Two-Factor Authentication'}
                </button>
                <button type="button" onClick={() => setView('setup-qr')} style={{ padding: '10px 16px', fontSize: 12, color: C.textSub, background: 'none', border: `1px solid ${C.border}`, borderRadius: 5, cursor: 'pointer' }}>
                  Back
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Disable MFA ─────────────────────────────────── */}
        {view === 'disable' && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}`, background: C.surfaceHdr }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, margin: 0 }}>Disable Two-Factor Authentication</p>
              <p style={{ fontSize: 11, color: C.textSub, margin: '3px 0 0' }}>Confirm your password to disable MFA. Your account will require only a password to sign in.</p>
            </div>
            <form onSubmit={handleDisable} style={{ padding: '24px' }}>
              <div style={{ marginBottom: 8, background: 'rgba(185,28,28,0.08)', border: '1px solid rgba(185,28,28,0.3)', borderRadius: 6, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AlertCircle style={{ width: 13, height: 13, color: '#f87171', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 11, color: '#fca5a5', margin: 0 }}>Disabling MFA reduces the security of your account. Anyone with your password can sign in.</p>
              </div>
              <div style={{ marginBottom: 20, marginTop: 16 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textSub, marginBottom: 7 }}>
                  Current Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: C.textMuted, pointerEvents: 'none' }} />
                  <input
                    data-testid="input-disable-mfa-password"
                    type={showDisablePass ? 'text' : 'password'}
                    value={disablePass}
                    onChange={e => setDisablePass(e.target.value)}
                    onFocus={() => setDisableFocus(true)}
                    onBlur={() => setDisableFocus(false)}
                    placeholder="Current password"
                    autoFocus
                    style={inputStyle(disableFocus)}
                  />
                  <button type="button" onClick={() => setShowDisablePass(v => !v)} tabIndex={-1} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 0 }}>
                    {showDisablePass ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  data-testid="button-mfa-disable-confirm"
                  type="submit"
                  disabled={!disablePass || disableLoading}
                  style={{ flex: 1, padding: '10px 16px', fontSize: 12, fontWeight: 700, color: '#fff', background: C.red, border: `1px solid ${C.red}`, borderRadius: 5, cursor: (!disablePass || disableLoading) ? 'not-allowed' : 'pointer', opacity: (!disablePass || disableLoading) ? 0.6 : 1 }}
                >
                  {disableLoading ? 'Disabling…' : 'Disable Two-Factor Authentication'}
                </button>
                <button type="button" onClick={() => setView('status')} style={{ padding: '10px 16px', fontSize: 12, color: C.textSub, background: 'none', border: `1px solid ${C.border}`, borderRadius: 5, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </Shell>
  );
}
