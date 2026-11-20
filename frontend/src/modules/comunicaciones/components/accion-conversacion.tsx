import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ESTADOS, rutaContexto, type ConsultaResumen, type TipoContexto } from '../conversaciones'

/**
 * Estado de la conversación de un trámite. Si existe, muestra el estado y el acceso; si no,
 * solo ofrece iniciarla (nunca un bloque vacío).
 */
export function AccionConversacion({
  tipo,
  id,
  consulta,
  className,
}: {
  tipo: TipoContexto
  id: string
  consulta?: ConsultaResumen
  className?: string
}) {
  if (!consulta) {
    return (
      <Link
        to={rutaContexto(tipo, id)}
        className={cn(
          'inline-flex min-h-9 items-center rounded-full px-3 text-[13px] font-semibold text-violeta hover:bg-violeta-suave',
          className,
        )}
      >
        Iniciar conversación
      </Link>
    )
  }
  return (
    <span className={cn('inline-flex flex-wrap items-center justify-end gap-2', className)}>
      <Badge variant={consulta.estado === 'resuelta' ? 'exito' : 'advertencia'}>
        {ESTADOS[consulta.estado]}
      </Badge>
      <Link
        to={`/comunicaciones/conversaciones/${consulta.id}`}
        className="text-[13px] font-semibold text-violeta hover:underline"
      >
        Abrir conversación
      </Link>
    </span>
  )
}
