import { Navigate, Outlet } from 'react-router'

interface RoleRouteProps {
  allowedRoles: string[]
}

export function RoleRoute({ allowedRoles }: RoleRouteProps) {
  const userRole = 'admin' // TODO: reemplazar por store/auth-store.ts cuando exista el módulo auth

  return allowedRoles.includes(userRole) ? <Outlet /> : <Navigate to="/" replace />
}
