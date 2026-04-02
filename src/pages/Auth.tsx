import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AegisLogo } from '@/components/layout/AegisLogo';
import { Eye, EyeOff, Shield, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ').max(255),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').max(128),
});


export default function Auth() {
  const [email, setEmail] = useState('admin@sonaro.local');
  const [password, setPassword] = useState('Admin123!');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { signIn, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
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
          toast.error('Email hoặc mật khẩu không chính xác');
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('Vui lòng xác nhận email trước khi đăng nhập');
        } else {
          toast.error(error.message);
        }
        setSubmitting(false);
        return;
      }
      toast.success('Đăng nhập thành công');
      navigate('/', { replace: true });
    } catch (err) {
      toast.error('Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, hsl(220,25%,12%) 0%, hsl(220,25%,18%) 50%, hsl(142,30%,15%) 100%)' }}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5"
        style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px)', backgroundSize: '50px 50px' }}
      />

      <div className="relative w-full max-w-md mx-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <AegisLogo size="lg" />
          <p className="text-gray-400 text-xs mt-2 tracking-wider">SECURITY MANAGEMENT CONSOLE</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-6 py-3 border-b border-white/10 bg-white/5">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-400">Đăng nhập hệ thống</span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@sonaro.local"
                  className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                  autoComplete="email"
                />
              </div>
              {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password}</p>}
            </div>

            <div className="text-xs text-gray-500 bg-white/5 border border-white/10 rounded p-3">
              <p className="font-medium text-gray-400 mb-1">Thông tin đăng nhập mặc định:</p>
              <p>Email: <span className="text-emerald-400 font-mono">admin@sonaro.local</span></p>
              <p>Mật khẩu: <span className="text-emerald-400 font-mono">Admin123!</span></p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-medium text-sm rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              Đăng nhập
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-gray-500 mt-6">
          Sonaro Gate • 2025.1 LTS • Next-Generation Firewall Management
        </p>
      </div>
    </div>
  );
}
