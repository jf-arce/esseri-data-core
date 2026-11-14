import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import type { Recurso } from '../hooks/use-detalle-direccion'

export function Estado<T>({
  recurso,
  vacio,
  children,
  carga,
  mensajeVacio = 'No hay registros para mostrar.',
}: {
  carga?: ReactNode
  recurso: Recurso<T>
  vacio: boolean
  children: ReactNode
  mensajeVacio?: ReactNode
}) {
  if (recurso.cargando)
    return (
      carga ?? (
        <div role="status" aria-label="Cargando sección" className="space-y-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-20 w-full" />
        </div>
      )
    )
  if (recurso.error)
    return (
      <p role="alert" className="py-4 text-sm text-error">
        {recurso.error}
      </p>
    )
  if (vacio) return <p className="py-5 text-sm text-texto-2">{mensajeVacio}</p>
  return children
}
