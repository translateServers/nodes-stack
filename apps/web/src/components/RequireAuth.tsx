import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuthStore } from '@/store';

export default function RequireAuth() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
