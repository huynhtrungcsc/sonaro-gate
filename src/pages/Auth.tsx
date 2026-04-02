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
const bugLogoSrc = '/bug-logo.png';

const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
});


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
            <img src={bugLogoSrc} alt="Sonaro Gate" className="w-14 h-14 select-none" draggable={false} />
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

            {/* Card heading */}
            <div className="px-7 pt-6 pb-1">
              <h1 className="text-[18px] font-semibold text-white tracking-tight leading-none">
                Sign in
              </h1>
              <p className="text-[12px] text-gray-500 mt-1.5">
                System Authentication — Sonaro Gate Management Console
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-7 pt-5 pb-6 space-y-5">
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
                className="flex items-start gap-2.5 rounded-lg px-4 py-3"
                style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.14)' }}
              >
                <svg className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-[10px] text-gray-500 font-medium mb-1">Default credentials for first-time setup</p>
                  <p className="text-[11px] font-mono">
                    <span className="text-gray-400">admin@sonaro.local</span>
                    <span className="text-gray-600 mx-1.5">/</span>
                    <span className="text-emerald-400 font-semibold">Admin123!</span>
                  </p>
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
