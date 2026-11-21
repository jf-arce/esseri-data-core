import { PlayIcon, SquareIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { ReglaWorkflow } from '@/modules/workflows/types'

interface BotonEstadoReglaProps {
  regla: ReglaWorkflow
  puedeActualizar: boolean
  onCambiarActivo: (regla: ReglaWorkflow) => void
}

/** Muestra la acción del clic: stop (rojo) si la regla está activa, play (verde) si está pausada. */
export function BotonEstadoRegla({
  regla,
  puedeActualizar,
  onCambiarActivo,
}: BotonEstadoReglaProps) {
  const etiqueta = `${regla.activo ? 'Detener' : 'Activar'} ${regla.nombre}`
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* El span deja que el tooltip funcione aunque el botón esté deshabilitado. */}
          <span className="inline-flex">
            <Button
              variant="secondary"
              size="icon"
              aria-label={etiqueta}
              disabled={!puedeActualizar}
              onClick={() => onCambiarActivo(regla)}
            >
              {regla.activo ? (
                <SquareIcon className="size-4.5 fill-current text-error" />
              ) : (
                <PlayIcon className="size-4.5 fill-current text-exito" />
              )}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{regla.activo ? 'Detener' : 'Activar'}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
