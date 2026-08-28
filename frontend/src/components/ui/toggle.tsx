import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Toggle as TogglePrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

const toggleVariants = cva(
  "group/toggle inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // chip de filtro (§9): borde propio, activo en violeta-suave
        default:
          'border border-borde bg-superficie text-texto-2 hover:bg-fila-hover data-[state=on]:border-violeta-borde data-[state=on]:bg-violeta-suave data-[state=on]:text-violeta',
        // botón segmentado (§9): sin borde propio, vive dentro de un contenedor píldora
        outline: 'text-texto-2 data-[state=on]:bg-violeta-suave data-[state=on]:text-violeta',
      },
      size: {
        default: 'h-8 min-w-8 px-3.5',
        sm: 'h-7 min-w-7 px-3 text-xs',
        lg: 'h-9 min-w-9 px-4',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Toggle({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
