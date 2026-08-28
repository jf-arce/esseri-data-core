import { ShieldAlert } from 'lucide-react'
import { Navigate, Outlet } from 'react-router'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { tienePermiso } from '@/modules/auth/constants'
import { useAuthStore } from '@/store/auth-store'

interface PermisoRouteProps {
  codigo: string
  /** Nombre legible del permiso para la Pantalla sin permiso, ej. "Autenticación · Leer". */
  label: string
}

// Hermano de RoleRoute, pero por permiso en vez de por rol: a diferencia de RoleRoute (que
// redirige a "/" en silencio), acá se muestra la Pantalla sin permiso (§9.6 de DESIGN.md) —
// nombra el permiso que falta en vez de desaparecer la ruta sin explicación.
export function PermisoRoute({ codigo, label }: PermisoRouteProps) {
  const permisos = useAuthStore((state) => state.usuario?.permisos ?? [])
  const status = useAuthStore((state) => state.status)

  if (status === 'idle' || status === 'loading') {
    return null
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }

  if (!tienePermiso(permisos, codigo)) {
    return (
      <Empty>
        <EmptyMedia variant="neutral">
          <ShieldAlert />
        </EmptyMedia>
        <EmptyTitle>No tenés acceso a esta sección</EmptyTitle>
        <EmptyDescription>
          Te falta el permiso <strong>{label}</strong>. Pedíselo a quien administre roles y permisos
          en tu institución.
        </EmptyDescription>
      </Empty>
    )
  }

  return <Outlet />
}
