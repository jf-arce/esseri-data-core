import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

type BotonIconoProps = Omit<ComponentProps<typeof Button>, 'aria-label'> & {
  /** Nombre accesible y texto del tooltip. */
  etiqueta: string
  lado?: 'top' | 'bottom' | 'left' | 'right'
}

/** Botón de solo ícono con su tooltip. Sirve también como disparador de un popover o menú. */
export function BotonIcono({
  etiqueta,
  lado = 'bottom',
  variant = 'ghost',
  size = 'icon',
  ...props
}: BotonIconoProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant={variant} size={size} aria-label={etiqueta} {...props} />
        </TooltipTrigger>
        <TooltipContent side={lado} sideOffset={2}>
          {etiqueta}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
