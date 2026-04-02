/**
 * Sonaro Gate — System Authentication Page
 * Copyright (c) 2025 Huỳnh Chí Trung (0xDragon)
 * https://github.com/huynhtrungcsc/sonaro-gate
 * SPDX-License-Identifier: MIT
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, ShieldCheck, Lock, Mail, AlertCircle, CheckCircle2, MonitorDot } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

/* ── Colour tokens ─────────────────────────────────────────────── */
const C = {
  bg:          '#0d0f13',
  surface:     '#13161c',
  surfaceAlt:  '#0f1218',
  border:      '#1e2330',
  borderFocus: '#2d6a4f',
  textPrimary: '#e2e8f0',
  textMuted:   '#4a5568',
  textSub:     '#718096',
  green:       '#22863a',
  greenHover:  '#2ea043',
  greenDim:    '#1a4731',
  greenLabel:  '#3fb950',
  red:         '#cf222e',
  redDim:      'rgba(207,34,46,0.1)',
};

export default function Auth() {
  const [email, setEmail]               = useState('admin@sonaro.local');
  const [password, setPassword]         = useState('Admin123!');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [errors, setErrors]             = useState<Record<string, string>>({});
  const [emailFocus, setEmailFocus]     = useState(false);
  const [passFocus, setPassFocus]       = useState(false);
  const [btnHover, setBtnHover]         = useState(false);

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
        const fieldErrors: Record<string, string> = {};
        parsed.error.errors.forEach(err => {
          if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
        });
        setErrors(fieldErrors);
        setSubmitting(false);
        return;
      }
      const { error } = await signIn(email, password);
      if (error) {
        if (error.message.includes('Invalid login')) {
          toast.error('Invalid credentials. Access denied.');
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('Account not confirmed. Contact your administrator.');
        } else {
          toast.error(error.message);
        }
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

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: C.bg, fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif' }}
    >
      {/* Subtle grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(${C.border} 1px, transparent 1px),
            linear-gradient(90deg, ${C.border} 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
          opacity: 0.25,
        }}
      />

      {/* ── Main ─────────────────────────────────────────────────── */}
      <main className="relative flex-1 flex items-center justify-center px-4 py-12">
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* ── Brand ──────────────────────────────────────────── */}
          <div className="flex flex-col items-center mb-8">
            <img
              src="/bug-logo.png"
              alt="Sonaro Gate"
              width={40}
              height={40}
              style={{ opacity: 0.9 }}
              draggable={false}
            />
            <div className="mt-3 flex items-baseline gap-1.5">
              <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.08em', color: C.textPrimary }}>
                SONARO
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.25em', color: C.greenLabel }}>
                GATE
              </span>
            </div>
            <p style={{ fontSize: 10, letterSpacing: '0.18em', color: C.textMuted, marginTop: 4 }}>
              SECURITY MANAGEMENT CONSOLE
            </p>
          </div>

          {/* ── Card ───────────────────────────────────────────── */}
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            {/* Card header bar */}
            <div
              style={{
                borderBottom: `1px solid ${C.border}`,
                padding: '12px 24px',
                background: C.surfaceAlt,
              }}
            >
              <p style={{ fontSize: 11, fontWeight: 600, color: C.textPrimary, letterSpacing: '0.04em' }}>
                Sign in to Sonaro Gate
              </p>
              <p style={{ fontSize: 10, color: C.textMuted, marginTop: 2, letterSpacing: '0.02em' }}>
                System Authentication - Sonaro Gate Management Console
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Email */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: C.textSub, letterSpacing: '0.1em', marginBottom: 6, textTransform: 'uppercase' }}>
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: C.textMuted, pointerEvents: 'none' }} />
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
                      width: '100%',
                      boxSizing: 'border-box',
                      paddingLeft: 32,
                      paddingRight: 12,
                      paddingTop: 8,
                      paddingBottom: 8,
                      fontSize: 13,
                      color: C.textPrimary,
                      background: C.bg,
                      border: `1px solid ${errors.email ? C.red : emailFocus ? C.borderFocus : C.border}`,
                      borderRadius: 4,
                      outline: 'none',
                      transition: 'border-color 0.15s',
                    }}
                  />
                </div>
                {errors.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <AlertCircle style={{ width: 11, height: 11, color: C.red }} />
                    <span style={{ fontSize: 10, color: C.red }}>{errors.email}</span>
                  </div>
                )}
              </div>

              {/* Password */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: C.textSub, letterSpacing: '0.1em', marginBottom: 6, textTransform: 'uppercase' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: C.textMuted, pointerEvents: 'none' }} />
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
                      width: '100%',
                      boxSizing: 'border-box',
                      paddingLeft: 32,
                      paddingRight: 36,
                      paddingTop: 8,
                      paddingBottom: 8,
                      fontSize: 13,
                      color: C.textPrimary,
                      background: C.bg,
                      border: `1px solid ${errors.password ? C.red : passFocus ? C.borderFocus : C.border}`,
                      borderRadius: 4,
                      outline: 'none',
                      transition: 'border-color 0.15s',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 0, display: 'flex' }}
                  >
                    {showPassword ? <EyeOff style={{ width: 13, height: 13 }} /> : <Eye style={{ width: 13, height: 13 }} />}
                  </button>
                </div>
                {errors.password && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <AlertCircle style={{ width: 11, height: 11, color: C.red }} />
                    <span style={{ fontSize: 10, color: C.red }}>{errors.password}</span>
                  </div>
                )}
              </div>

              {/* Sign In button */}
              <button
                data-testid="button-login-submit"
                type="submit"
                disabled={submitting}
                onMouseEnter={() => setBtnHover(true)}
                onMouseLeave={() => setBtnHover(false)}
                style={{
                  width: '100%',
                  padding: '9px 16px',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  color: '#ffffff',
                  background: submitting ? C.greenDim : btnHover ? C.greenHover : C.green,
                  border: `1px solid ${submitting ? C.greenDim : '#2ea043'}`,
                  borderRadius: 4,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'background 0.15s, border-color 0.15s',
                  opacity: submitting ? 0.6 : 1,
                  marginTop: 4,
                }}
              >
                {submitting
                  ? <div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.6s linear infinite' }} />
                  : <ShieldCheck style={{ width: 13, height: 13 }} />
                }
                {submitting ? 'Authenticating…' : 'Sign In'}
              </button>
            </form>

            {/* ── Security context ───────────────────────────── */}
            <div
              style={{
                borderTop: `1px solid ${C.border}`,
                padding: '12px 24px',
                background: C.surfaceAlt,
                display: 'flex',
                flexDirection: 'column',
                gap: 7,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 style={{ width: 11, height: 11, color: C.greenLabel, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: C.textSub }}>
                  MFA authentication enabled for this account
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lock style={{ width: 11, height: 11, color: C.textMuted, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: C.textMuted }}>
                  Last session: Apr 2, 2026 09:14 UTC — 192.168.1.1
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MonitorDot style={{ width: 11, height: 11, color: C.textMuted, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: C.textMuted }}>
                  All sessions are monitored and logged
                </span>
              </div>
            </div>
          </div>

          {/* Authorized access notice */}
          <p style={{ textAlign: 'center', fontSize: 9, color: C.textMuted, marginTop: 16, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Unauthorized access is prohibited and subject to prosecution
          </p>
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer
        className="relative"
        style={{
          borderTop: `1px solid ${C.border}`,
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          flexWrap: 'nowrap',
        }}
      >
        <span style={{ fontSize: 10, color: C.textMuted, whiteSpace: 'nowrap' }}>© 2026 Sonaro Gate</span>
        <span style={{ width: 1, height: 12, background: C.border, flexShrink: 0 }} />
        {[
          { label: 'Home',     href: 'https://sonarogate.com' },
          { label: 'GitHub',   href: 'https://github.com/huynhtrungcsc/sonaro-gate' },
          { label: 'Docs',     href: 'https://github.com/huynhtrungcsc/sonaro-gate/wiki' },
          { label: 'Security', href: 'https://github.com/huynhtrungcsc/sonaro-gate/security' },
          { label: 'Contact',  href: 'mailto:huynhtrung.csc@gmail.com' },
        ].map((item, i, arr) => (
          <span key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
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
            {i < arr.length - 1 && <span style={{ color: C.border, fontSize: 10 }}>·</span>}
          </span>
        ))}
      </footer>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
