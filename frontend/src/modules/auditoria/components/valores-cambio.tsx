import { ArrowRightIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface ValoresCambioProps {
  valorAnterior: string | null
  valorNuevo: string | null
  /** Recorta cada valor a una línea (para tablas); el texto completo queda en el `title`. */
  truncar?: boolean
}

// Convención de "antes/después" válida para cualquier campo auditado: no es un semáforo de
// estado, porque Auditoría no conoce el significado de negocio de cada entidad.
export function ValoresCambio({ valorAnterior, valorNuevo, truncar = false }: ValoresCambioProps) {
  const claseBadge = truncar ? 'max-w-[10rem] min-w-0' : undefined

  if (valorAnterior === null) {
    return (
      <Badge
        variant="info"
        className={claseBadge}
        title={truncar ? (valorNuevo ?? undefined) : undefined}
      >
        <TextoValor truncar={truncar}>{valorNuevo}</TextoValor>
      </Badge>
    )
  }
  if (valorNuevo === null) {
    return (
      <Badge
        variant="neutro"
        className={claseBadge ? `${claseBadge} line-through` : 'line-through'}
        title={truncar ? valorAnterior : undefined}
      >
        <TextoValor truncar={truncar}>{valorAnterior}</TextoValor>
      </Badge>
    )
  }
  return (
    <div
      className={
        truncar
          ? 'flex min-w-0 items-center gap-2 overflow-hidden'
          : 'flex flex-wrap items-center gap-2'
      }
    >
      <Badge variant="neutro" className={claseBadge} title={truncar ? valorAnterior : undefined}>
        <TextoValor truncar={truncar}>{valorAnterior}</TextoValor>
      </Badge>
      <ArrowRightIcon className="size-3.5 shrink-0 text-texto-3" />
      <Badge
        variant="info"
        className={claseBadge}
        title={truncar ? (valorNuevo ?? undefined) : undefined}
      >
        <TextoValor truncar={truncar}>{valorNuevo}</TextoValor>
      </Badge>
    </div>
  )
}

function TextoValor({ truncar, children }: { truncar: boolean; children: React.ReactNode }) {
  // El Badge es `inline-flex`: el truncado tiene que ir en el hijo con `min-w-0`, no en el
  // contenedor, o el texto desborda el badge en vez de recortarse.
  return truncar ? <span className="truncate">{children}</span> : <>{children}</>
}
