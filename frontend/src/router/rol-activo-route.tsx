import { Navigate, Outlet } from 'react-router'
import { useAuthStore } from '@/store/auth-store'

// Con sesión iniciada pero sin rol activo (cuenta con más de un rol, todavía sin elegir):
// manda a la pantalla "¿Cómo querés entrar?" en vez de dejar pasar a un shell sin rol —
// evita el bug original de mostrar Panel de Dirección y Panel Administrativo a la vez.
export function RolActivoRoute() {
  const rolActivo = useAuthStore((state) => state.rolActivo)

  if (rolActivo === null) {
    return <Navigate to="/elegir-perfil" replace />
  }

  return <Outlet />
}
