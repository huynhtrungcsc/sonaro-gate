/**
 * Sonaro Gate — System Authentication Page
 * Copyright (c) 2025 Huỳnh Chí Trung (0xDragon)
 * https://github.com/huynhtrungcsc/sonaro-gate
 * SPDX-License-Identifier: MIT
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, ShieldCheck, Lock, Mail, AlertCircle, CheckCircle2, MonitorDot, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

const C = {
  pageBg:      '#090c10',
  surface:     '#0f1318',
  surfaceHdr:  '#0c0f14',
  border:      '#1a2030',
  borderHover: '#222d3d',
  borderFocus: '#285c42',
  textPrimary: '#dce4ef',
  textMuted:   '#3d4d5c',
  textSub:     '#5a6e80',
  textDim:     '#2d3a46',
  green:       '#1c6e30',
  greenHover:  '#217a36',
  greenActive: '#186128',
  greenAccent: '#3fb950',
  greenDim:    'rgba(63,185,80,0.08)',
  red:         '#b91c1c',
};

export default function Auth() {
  const [email, setEmail]               = useState('admin@sonaro.local');
  const [password, setPassword]         = useState('Admin123!');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [errors, setErrors]             = useState<Record<string, string>>({});
  const [emailFocus, setEmailFocus]     = useState(false);
  const [passFocus, setPassFocus]       = useState(false);
  const [btnState, setBtnState]         = useState<'idle'|'hover'|'active'>('idle');

  const { signIn, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);
    try {
      const parsed = loginSchema.safeParse({ email, password });
      if (!parsed.success) {
        const fe: Record<string, string> = {};
        parsed.error.errors.forEach(err => { if (err.path[0]) fe[err.path[0] as string] = err.message; });
        setErrors(fe);
        setSubmitting(false);
        return;
      }
      const { error } = await signIn(email, password);
      if (error) {
        if (error.message.includes('Invalid login')) toast.error('Invalid credentials. Access denied.');
        else if (error.message.includes('Email not confirmed')) toast.error('Account not confirmed. Contact your administrator.');
        else toast.error(error.message);
        setSubmitting(false);
        return;
      }
      navigate('/', { replace: true });
    } catch {
      toast.error('Authentication service unavailable. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const btnBg = submitting ? C.greenActive
    : btnState === 'active' ? C.greenActive
    : btnState === 'hover'  ? C.greenHover
    : C.green;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: C.pageBg, fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif' }}>

      {/* Subtle background grid — 96px, very low opacity */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: `linear-gradient(${C.border} 1px, transparent 1px), linear-gradient(90deg, ${C.border} 1px, transparent 1px)`,
        backgroundSize: '96px 96px',
        opacity: 0.12,
      }} />

      {/* ── Main ─────────────────────────────────────────────────────── */}
      <main style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 16px' }}>
        <div style={{ width: '100%', maxWidth: 490 }}>

          {/* ── Brand block ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
            <img src="/bug-logo.png" alt="Sonaro Gate" width={44} height={44} style={{ opacity: 0.85 }} draggable={false} />

            <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '0.09em', color: C.textPrimary, lineHeight: 1 }}>
                SONARO
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.28em', color: C.greenAccent, lineHeight: 1 }}>
                GATE
              </span>
            </div>

            {/* Secure Access Portal badge */}
            <div style={{
              marginTop: 10, display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 3,
              border: `1px solid ${C.border}`,
              background: C.surfaceHdr,
            }}>
              <BadgeCheck style={{ width: 9, height: 9, color: C.greenAccent }} />
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: C.textSub, textTransform: 'uppercase' }}>
                Secure Access Portal
              </span>
            </div>
          </div>

          {/* ── Login card ──────────────────────────────────────────── */}
          <div style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: '0 1px 2px rgba(0,0,0,0.8), 0 8px 24px rgba(0,0,0,0.5), 0 24px 64px rgba(0,0,0,0.3)',
          }}>

            {/* Card header */}
            <div style={{
              padding: '18px 32px 16px',
              borderBottom: `1px solid ${C.border}`,
              background: C.surfaceHdr,
            }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, margin: 0, letterSpacing: '0.01em' }}>
                Sign in to Sonaro Gate
              </p>
              <p style={{ fontSize: 11, color: C.textSub, margin: '4px 0 0', letterSpacing: '0.01em' }}>
                Enter your credentials to access the management console
              </p>
            </div>

            {/* Form body */}
            <form onSubmit={handleSubmit} style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Email field */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textSub, marginBottom: 7 }}>
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: C.textMuted, pointerEvents: 'none' }} />
                  <input
                    data-testid="input-login-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onFocus={() => setEmailFocus(true)}
                    onBlur={() => setEmailFocus(false)}
                    placeholder="admin@sonaro.local"
                    autoComplete="email"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '10px 12px 10px 38px',
                      fontSize: 13, color: C.textPrimary,
                      background: C.pageBg,
                      border: `1px solid ${errors.email ? C.red : emailFocus ? C.borderFocus : C.border}`,
                      borderRadius: 5, outline: 'none',
                      transition: 'border-color 0.15s',
                    }}
                  />
                </div>
                {errors.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
                    <AlertCircle style={{ width: 11, height: 11, color: C.red, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: C.red }}>{errors.email}</span>
                  </div>
                )}
              </div>

              {/* Password field */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textSub, marginBottom: 7 }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: C.textMuted, pointerEvents: 'none' }} />
                  <input
                    data-testid="input-login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setPassFocus(true)}
                    onBlur={() => setPassFocus(false)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '10px 40px 10px 38px',
                      fontSize: 13, color: C.textPrimary,
                      background: C.pageBg,
                      border: `1px solid ${errors.password ? C.red : passFocus ? C.borderFocus : C.border}`,
                      borderRadius: 5, outline: 'none',
                      transition: 'border-color 0.15s',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 0, display: 'flex', alignItems: 'center' }}
                  >
                    {showPassword ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
                  </button>
                </div>
                {errors.password && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
                    <AlertCircle style={{ width: 11, height: 11, color: C.red, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: C.red }}>{errors.password}</span>
                  </div>
                )}
              </div>

              {/* Sign In button */}
              <button
                data-testid="button-login-submit"
                type="submit"
                disabled={submitting}
                onMouseEnter={() => setBtnState('hover')}
                onMouseLeave={() => setBtnState('idle')}
                onMouseDown={() => setBtnState('active')}
                onMouseUp={() => setBtnState('hover')}
                style={{
                  width: '100%', marginTop: 4,
                  padding: '11px 16px',
                  fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
                  color: '#ffffff',
                  background: btnBg,
                  border: `1px solid ${C.green}`,
                  borderRadius: 5,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  transition: 'background 0.1s',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting
                  ? <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', borderRadius: '50%', animation: 'sg-spin 0.65s linear infinite' }} />
                  : <ShieldCheck style={{ width: 14, height: 14 }} />
                }
                {submitting ? 'Authenticating…' : 'Sign In'}
              </button>
            </form>

            {/* Security context footer */}
            <div style={{
              borderTop: `1px solid ${C.border}`,
              padding: '14px 32px 16px',
              background: C.surfaceHdr,
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <CheckCircle2 style={{ width: 12, height: 12, color: C.greenAccent, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: C.textSub }}>MFA authentication enabled for this account</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <Lock style={{ width: 12, height: 12, color: C.textMuted, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: C.textMuted }}>Last session: Apr 2, 2026  09:14 UTC — 192.168.1.1</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <MonitorDot style={{ width: 12, height: 12, color: C.textMuted, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: C.textMuted }}>Protected by Sonaro Security Engine v2.5.1</span>
              </div>
            </div>
          </div>

          {/* Legal notice */}
          <p style={{ textAlign: 'center', fontSize: 9, letterSpacing: '0.07em', color: C.textDim, textTransform: 'uppercase', marginTop: 18 }}>
            Unauthorized access is strictly prohibited and subject to prosecution
          </p>
        </div>
      </main>

      {/* ── Page footer ──────────────────────────────────────────────── */}
      <footer style={{
        position: 'relative', zIndex: 1,
        borderTop: `1px solid ${C.border}`,
        padding: '10px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 18, flexWrap: 'nowrap',
      }}>
        <span style={{ fontSize: 10, color: C.textMuted, whiteSpace: 'nowrap' }}>© 2026 Sonaro Gate</span>
        <span style={{ width: 1, height: 12, background: C.border, flexShrink: 0 }} />
        {[
          { label: 'Home',     href: 'https://sonarogate.com' },
          { label: 'GitHub',   href: 'https://github.com/huynhtrungcsc/sonaro-gate' },
          { label: 'Docs',     href: 'https://github.com/huynhtrungcsc/sonaro-gate/wiki' },
          { label: 'Security', href: 'https://github.com/huynhtrungcsc/sonaro-gate/security' },
          { label: 'Contact',  href: 'mailto:huynhtrung.csc@gmail.com' },
        ].map((item, i, arr) => (
          <span key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 18, flexShrink: 0 }}>
            <a
              href={item.href}
              target={item.href.startsWith('mailto') ? undefined : '_blank'}
              rel="noopener noreferrer"
              style={{ fontSize: 10, color: C.textMuted, textDecoration: 'none', whiteSpace: 'nowrap' }}
              onMouseEnter={e => (e.currentTarget.style.color = C.textSub)}
              onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}
            >
              {item.label}
            </a>
            {i < arr.length - 1 && <span style={{ color: C.textDim, fontSize: 10 }}>·</span>}
          </span>
        ))}
      </footer>

      <style>{`
        @keyframes sg-spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #2d3a46; }
      `}</style>
    </div>
  );
}
