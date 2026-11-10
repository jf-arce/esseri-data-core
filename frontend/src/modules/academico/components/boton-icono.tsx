import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

type BotonIconoProps = Omit<ComponentProps<typeof Button>, 'size' | 'aria-label'> & {
  /** Nombre accesible y texto del tooltip. */
  etiqueta: string
}

export function BotonIcono({ etiqueta, variant = 'ghost', children, ...props }: BotonIconoProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant={variant} size="icon-sm" aria-label={etiqueta} {...props}>
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>{etiqueta}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
