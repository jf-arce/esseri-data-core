import { Link } from 'react-router'
import { MessageCircleIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { rutaContexto, type ConsultaResumen, type TipoContexto } from '../conversaciones'

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
          'inline-flex min-h-8 items-center gap-1.5 rounded-full border border-violeta/40 px-2.5 text-[12.5px] font-semibold whitespace-nowrap text-violeta transition-colors hover:bg-violeta-suave',
          className,
        )}
      >
        <MessageCircleIcon aria-hidden="true" className="size-3.5" />
        Iniciar conversación
      </Link>
    )
  }
  return (
    <Link
      to={`/comunicaciones/conversaciones/${consulta.id}`}
      className={cn(
        'inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[#F1E4FB] px-2.5 text-[12.5px] font-semibold whitespace-nowrap text-[#7A2FA8] transition-colors hover:bg-[#E8D8F7]',
        className,
      )}
    >
      <MessageCircleIcon aria-hidden="true" className="size-3.5" />
      Ver conversación
    </Link>
  )
}
