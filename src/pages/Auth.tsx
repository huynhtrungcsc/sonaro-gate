/**
 * Sonaro Gate — System Authentication Page
 * Copyright (c) 2025 Huỳnh Chí Trung (0xDragon)
 * https://github.com/huynhtrungcsc/sonaro-gate
 * SPDX-License-Identifier: MIT
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Shield, Lock, Mail, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

/* ── Bug icon — stylised geometric beetle ───────────────────────── */
function BugLogo() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Antennae */}
      <line x1="18" y1="10" x2="10" y2="2"  stroke="#4ade80" strokeWidth="2" strokeLinecap="round"/>
      <line x1="34" y1="10" x2="42" y2="2"  stroke="#4ade80" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="10" cy="2"  r="1.5" fill="#4ade80"/>
      <circle cx="42" cy="2"  r="1.5" fill="#4ade80"/>
      {/* Head */}
      <ellipse cx="26" cy="13" rx="9" ry="7"
        fill="url(#bug-head)" stroke="rgba(74,222,128,0.5)" strokeWidth="1"/>
      {/* Eyes */}
      <circle cx="21.5" cy="12" r="2" fill="#fff" opacity="0.9"/>
      <circle cx="30.5" cy="12" r="2" fill="#fff" opacity="0.9"/>
      <circle cx="21.5" cy="12" r="0.8" fill="#0d2010"/>
      <circle cx="30.5" cy="12" r="0.8" fill="#0d2010"/>
      {/* Body shell (elytra) — left half */}
      <path d="M17 20 Q10 24 11 36 Q14 46 26 47 L26 18 Q22 18 17 20Z"
        fill="url(#bug-left)" stroke="rgba(74,222,128,0.4)" strokeWidth="0.8"/>
      {/* Body shell — right half */}
      <path d="M35 20 Q42 24 41 36 Q38 46 26 47 L26 18 Q30 18 35 20Z"
        fill="url(#bug-right)" stroke="rgba(74,222,128,0.4)" strokeWidth="0.8"/>
      {/* Centre line */}
      <line x1="26" y1="18" x2="26" y2="47" stroke="rgba(74,222,128,0.35)" strokeWidth="1"/>
      {/* Spot pattern */}
      <circle cx="20" cy="28" r="2.5" fill="rgba(74,222,128,0.18)"/>
      <circle cx="20" cy="37" r="2"   fill="rgba(74,222,128,0.18)"/>
      <circle cx="32" cy="28" r="2.5" fill="rgba(74,222,128,0.18)"/>
      <circle cx="32" cy="37" r="2"   fill="rgba(74,222,128,0.18)"/>
      {/* Legs — left */}
      <line x1="14" y1="24" x2="4"  y2="20" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="12" y1="32" x2="2"  y2="31" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="13" y1="40" x2="4"  y2="43" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Legs — right */}
      <line x1="38" y1="24" x2="48" y2="20" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="40" y1="32" x2="50" y2="31" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="39" y1="40" x2="48" y2="43" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round"/>
      <defs>
        <linearGradient id="bug-head" x1="26" y1="6" x2="26" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22c55e"/>
          <stop offset="100%" stopColor="#15803d"/>
        </linearGradient>
        <linearGradient id="bug-left" x1="14" y1="18" x2="26" y2="47" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#16a34a"/>
          <stop offset="100%" stopColor="#052e16"/>
        </linearGradient>
        <linearGradient id="bug-right" x1="38" y1="18" x2="26" y2="47" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#16a34a"/>
          <stop offset="100%" stopColor="#052e16"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function Auth() {
  const [email, setEmail]               = useState('admin@sonaro.local');
  const [password, setPassword]         = useState('Admin123!');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [errors, setErrors]             = useState<Record<string, string>>({});

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
          toast.error('Invalid email or password');
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('Please confirm your email before signing in');
        } else {
          toast.error(error.message);
        }
        setSubmitting(false);
        return;
      }
      toast.success('Access granted');
      navigate('/', { replace: true });
    } catch {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputBase =
    'w-full pl-9 pr-3 py-2.5 text-[13px] text-white placeholder:text-gray-600 rounded-lg focus:outline-none transition-colors';

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(160deg, #0b1520 0%, #0d1e17 60%, #0a1a10 100%)' }}
    >
      {/* ── Main content — centred vertically & horizontally ─────── */}
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[480px]">

          {/* Brand — centred */}
          <div className="flex flex-col items-center mb-8">
            <BugLogo />
            <div className="mt-4 flex items-baseline gap-2 justify-center">
              <span className="text-2xl font-extrabold tracking-[0.1em] text-white leading-none">
                SONARO
              </span>
              <span className="text-sm font-bold tracking-[0.3em] text-emerald-400 leading-none">
                GATE
              </span>
            </div>
            <p className="text-[10px] tracking-[0.22em] text-gray-500 mt-1.5 uppercase">
              Security Management Console
            </p>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}
          >
            {/* Top accent line */}
            <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

            {/* Card header */}
            <div
              className="flex items-center gap-2.5 px-7 py-3.5 border-b"
              style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-semibold tracking-[0.15em] text-emerald-400 uppercase">
                System Authentication
              </span>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-7 py-6 space-y-5">
              {/* Email */}
              <div>
                <label className="block text-[10px] tracking-[0.15em] uppercase text-gray-500 mb-2 font-medium">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
                  <input
                    data-testid="input-login-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="admin@sonaro.local"
                    autoComplete="email"
                    className={inputBase}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: errors.email ? '1px solid rgba(239,68,68,0.55)' : '1px solid rgba(255,255,255,0.1)',
                    }}
                    onFocus={e => { if (!errors.email) e.currentTarget.style.border = '1px solid rgba(74,222,128,0.5)'; }}
                    onBlur={e => { if (!errors.email) e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'; }}
                  />
                </div>
                {errors.email && (
                  <p className="text-[10px] text-red-400 mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" /> {errors.email}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] tracking-[0.15em] uppercase text-gray-500 mb-2 font-medium">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
                  <input
                    data-testid="input-login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className={`${inputBase} pr-10`}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: errors.password ? '1px solid rgba(239,68,68,0.55)' : '1px solid rgba(255,255,255,0.1)',
                    }}
                    onFocus={e => { if (!errors.password) e.currentTarget.style.border = '1px solid rgba(74,222,128,0.5)'; }}
                    onBlur={e => { if (!errors.password) e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-[10px] text-red-400 mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" /> {errors.password}
                  </p>
                )}
              </div>

              {/* Default credentials */}
              <div
                className="rounded-lg px-4 py-3"
                style={{ background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.12)' }}
              >
                <p className="text-[9px] tracking-[0.18em] uppercase text-gray-600 mb-2 font-semibold">
                  Default Credentials
                </p>
                <div className="font-mono text-[11px] space-y-0.5">
                  <p><span className="text-gray-600 mr-2">login</span><span className="text-emerald-400">admin@sonaro.local</span></p>
                  <p><span className="text-gray-600 mr-2">pass </span><span className="text-emerald-400">Admin123!</span></p>
                </div>
              </div>

              {/* Sign In */}
              <button
                data-testid="button-login-submit"
                type="submit"
                disabled={submitting}
                className="w-full py-3 font-semibold text-[13px] tracking-wider rounded-lg flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                  boxShadow: '0 4px 20px rgba(22,163,74,0.3)',
                  color: '#fff',
                }}
              >
                {submitting
                  ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Shield className="w-3.5 h-3.5" />}
                {submitting ? 'Authenticating…' : 'Sign In'}
              </button>
            </form>

            {/* Security notice */}
            <div
              className="px-7 py-3 border-t text-center"
              style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}
            >
              <p className="text-[9px] tracking-[0.12em] text-gray-700 uppercase whitespace-nowrap">
                Authorized access only · All sessions are monitored and logged
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer — always pinned to bottom of page ─────────────── */}
      <footer
        className="w-full flex items-center justify-center gap-3 px-6 py-4 border-t"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
      >
        <svg width="13" height="13" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 opacity-60">
          <ellipse cx="26" cy="32" rx="14" ry="17" fill="rgba(74,222,128,0.3)" stroke="rgba(74,222,128,0.5)" strokeWidth="1.5"/>
          <ellipse cx="26" cy="14" rx="8" ry="6" fill="rgba(74,222,128,0.3)" stroke="rgba(74,222,128,0.5)" strokeWidth="1.5"/>
        </svg>
        <span className="text-[10px] text-gray-600 whitespace-nowrap">© 2025 Huỳnh Chí Trung</span>
        <span className="w-px h-3 bg-gray-800 shrink-0" />
        {[
          { label: 'Home',     href: 'https://sonarogate.com' },
          { label: 'GitHub',   href: 'https://github.com/huynhtrungcsc/sonaro-gate' },
          { label: 'Docs',     href: 'https://github.com/huynhtrungcsc/sonaro-gate/wiki' },
          { label: 'Security', href: 'https://github.com/huynhtrungcsc/sonaro-gate/security' },
          { label: 'Contact',  href: 'mailto:huynhtrung.csc@gmail.com' },
        ].map((item, i, arr) => (
          <span key={item.label} className="flex items-center gap-3 shrink-0">
            <a
              href={item.href}
              target={item.href.startsWith('mailto') ? undefined : '_blank'}
              rel="noopener noreferrer"
              className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors whitespace-nowrap"
            >
              {item.label}
            </a>
            {i < arr.length - 1 && <span className="text-gray-800 text-[10px]">·</span>}
          </span>
        ))}
      </footer>
    </div>
  );
}
