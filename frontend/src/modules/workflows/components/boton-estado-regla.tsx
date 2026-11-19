import { PlayIcon, SquareIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { ReglaWorkflow } from '@/modules/workflows/types'

interface BotonEstadoReglaProps {
  regla: ReglaWorkflow
  puedeActualizar: boolean
  onCambiarActivo: (regla: ReglaWorkflow) => void
}

/** Play (verde) si la regla está activa, stop (rojo) si está pausada. Un clic la cambia. */
export function BotonEstadoRegla({
  regla,
  puedeActualizar,
  onCambiarActivo,
}: BotonEstadoReglaProps) {
  const etiqueta = `${regla.activo ? 'Pausar' : 'Activar'} ${regla.nombre}`
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
                <PlayIcon className="size-4.5 fill-current text-exito" />
              ) : (
                <SquareIcon className="size-4.5 fill-current text-error" />
              )}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {regla.activo ? 'Activa · clic para pausar' : 'Pausada · clic para activar'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
