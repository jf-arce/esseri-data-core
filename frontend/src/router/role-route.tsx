import { Navigate, Outlet } from 'react-router'
import { useAuthStore } from '@/store/auth-store'

interface RoleRouteProps {
  allowedRoles: string[]
}

export function RoleRoute({ allowedRoles }: RoleRouteProps) {
  const roles = useAuthStore((state) => state.usuario?.roles ?? [])
  const tienePermiso = roles.some((rol) => allowedRoles.includes(rol))

  return tienePermiso ? <Outlet /> : <Navigate to="/" replace />
}
