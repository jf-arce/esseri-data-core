import { CompassIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { rutaInicioDe } from '@/layout/nav-items'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

// Una ruta que no existe, igual para consola, portal docente y portal familia. Vive fuera de
// `VistaRoute`: con el comodín adentro de la consola, una persona de familia o docente sería
// redirigida a su inicio antes de ver el aviso.
export function NoEncontradaPage() {
  const rolActivo = useAuthStore((state) => state.rolActivo)
  const permisos = useAuthStore(permisosActivos)
  const inicio = rutaInicioDe(rolActivo, permisos) ?? '/'

  return (
    <div className="flex min-h-svh items-center justify-center bg-lienzo p-6">
      <Empty className="max-w-md rounded-panel bg-superficie shadow-card">
        <EmptyMedia variant="neutral">
          <CompassIcon />
        </EmptyMedia>
        <EmptyTitle>No encontramos esta página</EmptyTitle>
        <EmptyDescription>
          El link puede estar mal escrito o la página ya no existe.
        </EmptyDescription>
        <EmptyContent>
          <Button asChild>
            <Link to={inicio}>Ir al inicio</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}
