import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

/** Marca que el tablero se actualiza solo (ver `useRefrescoPeriodico`). */
export function EnVivo() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="img"
            aria-label="En vivo"
            className="inline-flex size-2 rounded-full bg-exito motion-safe:animate-[en-vivo-respirar_2s_ease-in-out_infinite]"
          />
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="max-w-64 text-balance">
          Se actualizan solos cada 30 segundos: Ejecuciones, Requiere tu atención y Actividad. Las
          reglas se actualizan al recargar la página.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
