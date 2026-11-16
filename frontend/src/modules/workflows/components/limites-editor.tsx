import { InfoIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { MAX_NODOS, MAX_PROFUNDIDAD } from '@/modules/workflows/constants'

/** Topes de la regla, al pasar el mouse. */
export function LimitesEditor() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Límites de la regla">
            <InfoIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="block max-w-72 space-y-1">
          <p>
            Tope por regla: {MAX_NODOS} bloques y {MAX_PROFUNDIDAD} niveles.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
