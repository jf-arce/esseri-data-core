import { ShieldAlert } from 'lucide-react'
import { Navigate } from 'react-router'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { rutaInicioDe } from '@/layout/nav-items'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

// La ruta "/" del shell: redirige a la pantalla principal del rol activo (§ Ruteo por rol del
// diseño) — nunca una bienvenida genérica compartida por todos los roles. `rutaInicioDe` usa el
// mismo árbol de navegación filtrado que el sidebar, así que "principal" siempre significa "el
// primer lugar al que el rol activo puede entrar".
export function InicioRoute() {
  const rolActivo = useAuthStore((state) => state.rolActivo)
  const permisos = useAuthStore(permisosActivos)
  const destino = rutaInicioDe(rolActivo, permisos)

  if (destino === null) {
    return (
      <Empty>
        <EmptyMedia variant="neutral">
          <ShieldAlert />
        </EmptyMedia>
        <EmptyTitle>Todavía no tenés acceso a ninguna sección</EmptyTitle>
        <EmptyDescription>
          Tu cuenta no tiene permisos asignados. Pedíselos a quien administre roles y permisos en tu
          institución.
        </EmptyDescription>
      </Empty>
    )
  }

  return <Navigate to={destino} replace />
}
