/**
 * Sonaro Gate — System Authentication Page
 * Copyright (c) 2025 Huỳnh Chí Trung (0xDragon)
 * https://github.com/huynhtrungcsc/sonaro-gate
 * SPDX-License-Identifier: MIT
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AegisLogo } from '@/components/layout/AegisLogo';
import { Eye, EyeOff, Shield, Lock, Mail, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

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

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, hsl(220,28%,9%) 0%, hsl(220,25%,14%) 55%, hsl(142,32%,11%) 100%)',
      }}
    >
      {/* Subtle dot-grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(74,222,128,0.07) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />

      {/* Ambient glow — bottom right */}
      <div
        className="absolute bottom-0 right-0 w-[500px] h-[400px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at bottom right, rgba(22,163,74,0.12) 0%, transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-[400px] mx-4 z-10">

        {/* ── Logo block ─────────────────────────────────────────────── */}
        <div className="flex flex-col items-center mb-8">
          <AegisLogo size="lg" />
          <p className="text-[10px] tracking-[0.25em] text-gray-500 mt-2 uppercase">
            Security Management Console
          </p>
        </div>

        {/* ── Login card ─────────────────────────────────────────────── */}
        <div
          className="rounded-xl overflow-hidden shadow-2xl"
          style={{
            background: 'rgba(12,22,18,0.80)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(74,222,128,0.14)',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.4), 0 24px 48px rgba(0,0,0,0.5), 0 0 80px rgba(22,163,74,0.06)',
          }}
        >
          {/* Top accent line */}
          <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />

          {/* Card header */}
          <div
            className="flex items-center gap-2.5 px-6 py-3 border-b"
            style={{ borderColor: 'rgba(74,222,128,0.1)', background: 'rgba(255,255,255,0.02)' }}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-semibold tracking-[0.12em] text-emerald-400 uppercase">
              System Authentication
            </span>
          </div>

          {/* Form body */}
          <form onSubmit={handleSubmit} className="px-6 pt-6 pb-5 space-y-4">

            {/* Email */}
            <div>
              <label className="block text-[10px] tracking-[0.12em] uppercase text-gray-500 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                <input
                  data-testid="input-login-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@sonaro.local"
                  autoComplete="email"
                  className="w-full pl-9 pr-3 py-2.5 text-[12px] text-white placeholder:text-gray-600 rounded-lg transition-colors focus:outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: errors.email
                      ? '1px solid rgba(239,68,68,0.6)'
                      : '1px solid rgba(255,255,255,0.08)',
                  }}
                  onFocus={e => { if (!errors.email) e.currentTarget.style.border = '1px solid rgba(74,222,128,0.45)'; }}
                  onBlur={e => { if (!errors.email) e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)'; }}
                />
              </div>
              {errors.email && (
                <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {errors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-[10px] tracking-[0.12em] uppercase text-gray-500 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                <input
                  data-testid="input-login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-9 pr-10 py-2.5 text-[12px] text-white placeholder:text-gray-600 rounded-lg transition-colors focus:outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: errors.password
                      ? '1px solid rgba(239,68,68,0.6)'
                      : '1px solid rgba(255,255,255,0.08)',
                  }}
                  onFocus={e => { if (!errors.password) e.currentTarget.style.border = '1px solid rgba(74,222,128,0.45)'; }}
                  onBlur={e => { if (!errors.password) e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)'; }}
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
                <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {errors.password}
                </p>
              )}
            </div>

            {/* Default credentials hint */}
            <div
              className="rounded-lg px-3.5 py-2.5 text-[10px]"
              style={{
                background: 'rgba(74,222,128,0.04)',
                border: '1px solid rgba(74,222,128,0.1)',
              }}
            >
              <p className="text-[9px] tracking-[0.15em] uppercase text-gray-600 mb-1.5 font-medium">
                Default Credentials
              </p>
              <p className="font-mono text-gray-400">
                <span className="text-gray-600">login </span>
                <span className="text-emerald-400">admin@sonaro.local</span>
              </p>
              <p className="font-mono text-gray-400">
                <span className="text-gray-600">pass  </span>
                <span className="text-emerald-400">Admin123!</span>
              </p>
            </div>

            {/* Sign In button */}
            <button
              data-testid="button-login-submit"
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 font-semibold text-[12px] tracking-wider rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: submitting
                  ? 'rgba(22,163,74,0.6)'
                  : 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                color: '#fff',
                boxShadow: '0 4px 16px rgba(22,163,74,0.25)',
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

          {/* Authorized access notice */}
          <div
            className="px-6 py-2.5 border-t text-center"
            style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.15)' }}
          >
            <p className="text-[9px] tracking-[0.15em] text-gray-700 uppercase">
              Authorized access only · All sessions are monitored and logged
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-gray-700 mt-5 tracking-widest uppercase">
          Sonaro Gate · 2025.1 LTS · Next-Generation Firewall
        </p>
      </div>
    </div>
  );
}
