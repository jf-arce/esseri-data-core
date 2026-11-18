import { RadioIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

/** Marca que el tablero se actualiza solo (ver `useRefrescoPeriodico`). */
export function EnVivo() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="exito" className="gap-1.5 before:hidden">
            <RadioIcon className="size-3.5 motion-safe:animate-pulse" aria-hidden="true" />
            En vivo
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="max-w-64 text-balance">
          Se actualizan solos cada 30 segundos: Ejecuciones, Requiere tu atención y Actividad. Las
          reglas se actualizan al recargar la página.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
