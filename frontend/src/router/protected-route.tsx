import { Navigate, Outlet } from 'react-router'

export function ProtectedRoute() {
  const isAuthenticated = true // TODO: reemplazar por store/auth-store.ts cuando exista el módulo auth

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}
