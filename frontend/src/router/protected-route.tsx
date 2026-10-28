import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { guardarDestino } from '@/modules/auth/utils'
import { useAuthStore } from '@/store/auth-store'

export function ProtectedRoute() {
  const status = useAuthStore((state) => state.status)
  const { pathname, search } = useLocation()

  // Un efecto y no el render: así se guarda una vez aunque React renderice dos veces.
  useEffect(() => {
    if (status === 'unauthenticated') guardarDestino(pathname + search)
  }, [status, pathname, search])

  if (status === 'idle' || status === 'loading') return null
  return status === 'authenticated' ? <Outlet /> : <Navigate to="/login" replace />
}
