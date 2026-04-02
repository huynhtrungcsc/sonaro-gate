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

function SonaroShield() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20 3L5 9.5V20c0 8.5 6.5 16.5 15 18.5C29.5 36.5 36 28.5 36 20V9.5L20 3Z"
        fill="url(#shield-grad)"
        stroke="rgba(74,222,128,0.5)"
        strokeWidth="1"
      />
      <path
        d="M14 20l4 4 8-8"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="shield-grad" x1="20" y1="3" x2="20" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#16a34a" />
          <stop offset="100%" stopColor="#064e28" />
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
    'w-full pl-9 pr-3 py-2.5 text-[13px] text-white placeholder:text-gray-600 rounded-lg transition-colors focus:outline-none';

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(160deg, #0b1520 0%, #0d1e17 60%, #0a1a10 100%)' }}
    >
      <div className="w-full max-w-[520px] px-5">

        {/* ── Brand ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3.5 mb-8">
          <SonaroShield />
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold tracking-[0.1em] text-white leading-none">
                SONARO
              </span>
              <span className="text-sm font-bold tracking-[0.3em] text-emerald-400 leading-none">
                GATE
              </span>
            </div>
            <p className="text-[10px] tracking-[0.2em] text-gray-500 mt-1 uppercase">
              Security Management Console
            </p>
          </div>
        </div>

        {/* ── Card ─────────────────────────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          }}
        >
          {/* Thin top line */}
          <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

          {/* Header */}
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
                    border: errors.email
                      ? '1px solid rgba(239,68,68,0.55)'
                      : '1px solid rgba(255,255,255,0.1)',
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
                    border: errors.password
                      ? '1px solid rgba(239,68,68,0.55)'
                      : '1px solid rgba(255,255,255,0.1)',
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

            {/* Default credentials hint */}
            <div
              className="rounded-lg px-4 py-3"
              style={{
                background: 'rgba(74,222,128,0.04)',
                border: '1px solid rgba(74,222,128,0.12)',
              }}
            >
              <p className="text-[9px] tracking-[0.18em] uppercase text-gray-600 mb-2 font-semibold">
                Default Credentials
              </p>
              <div className="font-mono text-[11px] space-y-0.5">
                <p className="text-gray-400">
                  <span className="text-gray-600 mr-2">login</span>
                  <span className="text-emerald-400">admin@sonaro.local</span>
                </p>
                <p className="text-gray-400">
                  <span className="text-gray-600 mr-2">pass </span>
                  <span className="text-emerald-400">Admin123!</span>
                </p>
              </div>
            </div>

            {/* Submit */}
            <button
              data-testid="button-login-submit"
              type="submit"
              disabled={submitting}
              className="w-full py-3 font-semibold text-[13px] tracking-wider rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                boxShadow: '0 4px 20px rgba(22,163,74,0.3)',
                color: '#fff',
              }}
            >
              {submitting ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Shield className="w-3.5 h-3.5" />
              )}
              {submitting ? 'Authenticating…' : 'Sign In'}
            </button>
          </form>

          {/* Security notice */}
          <div
            className="px-7 py-3 border-t"
            style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}
          >
            <p className="text-[9px] tracking-[0.12em] text-gray-700 uppercase text-center whitespace-nowrap">
              Authorized access only · All sessions are monitored and logged
            </p>
          </div>
        </div>

        {/* Page footer */}
        <p className="text-center text-[10px] text-gray-700 mt-5 tracking-widest uppercase whitespace-nowrap">
          Sonaro Gate · 2025.1 LTS · Next-Generation Firewall
        </p>
      </div>
    </div>
  );
}
