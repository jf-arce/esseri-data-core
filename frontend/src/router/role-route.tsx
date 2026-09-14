import { Navigate, Outlet } from 'react-router'
import { useAuthStore } from '@/store/auth-store'

interface RoleRouteProps {
  allowedRoles: string[]
}

// Filtra por el ROL ACTIVO (la vista elegida en "¿Cómo querés entrar?"/"Cambiar vista"), no
// por la suma de roles de la cuenta: con dos roles asignados (ej. docente + familia), entrar
// como "docente" no debe abrir las rutas de "familia" aunque la cuenta también tenga ese rol.
export function RoleRoute({ allowedRoles }: RoleRouteProps) {
  const rolActivo = useAuthStore((state) => state.rolActivo)
  const tieneRol = rolActivo !== null && allowedRoles.includes(rolActivo)

  return tieneRol ? <Outlet /> : <Navigate to="/" replace />
}
