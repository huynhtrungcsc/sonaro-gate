import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { AppRole } from '@/lib/postgrest';
import { apiFetch } from '@/lib/postgrest';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: AppRole[];
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { user, roles, loading } = useAuth();
  const location = useLocation();
  const [setupChecked, setSetupChecked] = useState(false);
  const [setupComplete, setSetupComplete] = useState(true);

  useEffect(() => {
    if (!user) return;
    apiFetch('/api/setup/status')
      .then((d: any) => {
        setSetupComplete(!!d.complete);
        setSetupChecked(true);
      })
      .catch(() => {
        setSetupComplete(true);
        setSetupChecked(true);
      });
  }, [user]);

  if (loading || (user && !setupChecked)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Đang xác thực...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!setupComplete && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }

  if (requiredRoles && requiredRoles.length > 0) {
    const hasRequired = requiredRoles.some(role => roles.includes(role));
    if (!hasRequired && roles.length > 0) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))]">
          <div className="text-center">
            <h2 className="text-lg font-bold text-destructive">Không có quyền truy cập</h2>
            <p className="text-sm text-muted-foreground mt-1">Bạn không có quyền xem trang này.</p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
