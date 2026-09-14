import { Navigate, Outlet } from 'react-router'
import { rutaInicioDe, vistaDe, type Vista } from '@/layout/nav-items'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

interface VistaRouteProps {
  vista: Vista
}

// Filtra por shell (Consola / Portal Docente / Portal Familia), no por permiso puntual: cada
// rol activo entra solo a la vista que le corresponde (§8 DESIGN.md) — un docente nunca ve la
// consola de backoffice ni por deep link, y viceversa. A diferencia de RoleRoute (que manda a
// "/" en silencio), acá se redirige directo al inicio del rol activo: nunca a "/", que podría
// no pertenecer a su propia vista y generar un loop.
export function VistaRoute({ vista }: VistaRouteProps) {
  const rolActivo = useAuthStore((state) => state.rolActivo)
  const permisos = useAuthStore(permisosActivos)

  if (vistaDe(rolActivo) !== vista) {
    return <Navigate to={rutaInicioDe(rolActivo, permisos) ?? '/'} replace />
  }

  return <Outlet />
}
