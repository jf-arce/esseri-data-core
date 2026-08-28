import { Navigate, Outlet } from 'react-router'
import { useAuthStore } from '@/store/auth-store'

export function ProtectedRoute() {
  const status = useAuthStore((state) => state.status)

  if (status === 'idle' || status === 'loading') return null
  return status === 'authenticated' ? <Outlet /> : <Navigate to="/login" replace />
}
