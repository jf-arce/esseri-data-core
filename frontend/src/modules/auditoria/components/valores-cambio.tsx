import { ArrowRightIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface ValoresCambioProps {
  valorAnterior: string | null
  valorNuevo: string | null
}

// Convención de "antes/después" válida para cualquier campo auditado: no es un semáforo de
// estado, porque Auditoría no conoce el significado de negocio de cada entidad.
export function ValoresCambio({ valorAnterior, valorNuevo }: ValoresCambioProps) {
  if (valorAnterior === null) {
    return <Badge variant="info">{valorNuevo}</Badge>
  }
  if (valorNuevo === null) {
    return (
      <Badge variant="neutro" className="line-through">
        {valorAnterior}
      </Badge>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="neutro">{valorAnterior}</Badge>
      <ArrowRightIcon className="size-3.5 shrink-0 text-texto-3" />
      <Badge variant="info">{valorNuevo}</Badge>
    </div>
  )
}
