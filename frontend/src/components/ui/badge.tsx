import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'

import { cn } from '@/lib/utils'

// Badge de estado (DESIGN.md §2.4/§9): el estado nunca se comunica solo por color, así que las
// variantes semánticas llevan el punto indicador horneado vía ::before, no como prop aparte.
// Badge de módulo (§9.3): usar variant="modulo" data-modulo="familias|academico|inscripciones|
// facturacion|compras|workflows|auditoria|ia" — es identidad de dominio, no lleva punto.
const badgeVariants = cva(
  'group/badge inline-flex h-[22px] w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-colors has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3!',
  {
    variants: {
      variant: {
        exito:
          "bg-exito-suave text-exito before:content-[''] before:size-1.5 before:shrink-0 before:rounded-full before:bg-current",
        advertencia:
          "bg-advertencia-suave text-advertencia before:content-[''] before:size-1.5 before:shrink-0 before:rounded-full before:bg-current",
        error:
          "bg-error-suave text-error before:content-[''] before:size-1.5 before:shrink-0 before:rounded-full before:bg-current",
        info: "bg-info-suave text-info before:content-[''] before:size-1.5 before:shrink-0 before:rounded-full before:bg-current",
        modulo:
          'data-[modulo=familias]:bg-[color-mix(in_oklch,var(--mod-familias)_12%,white)] data-[modulo=familias]:text-mod-familias data-[modulo=academico]:bg-[color-mix(in_oklch,var(--mod-academico)_12%,white)] data-[modulo=academico]:text-mod-academico data-[modulo=inscripciones]:bg-[color-mix(in_oklch,var(--mod-inscripciones)_12%,white)] data-[modulo=inscripciones]:text-mod-inscripciones data-[modulo=facturacion]:bg-[color-mix(in_oklch,var(--mod-facturacion)_12%,white)] data-[modulo=facturacion]:text-mod-facturacion data-[modulo=compras]:bg-[color-mix(in_oklch,var(--mod-compras)_12%,white)] data-[modulo=compras]:text-mod-compras data-[modulo=workflows]:bg-[color-mix(in_oklch,var(--mod-workflows)_12%,white)] data-[modulo=workflows]:text-mod-workflows data-[modulo=auditoria]:bg-[color-mix(in_oklch,var(--mod-auditoria)_12%,white)] data-[modulo=auditoria]:text-mod-auditoria data-[modulo=ia]:bg-[color-mix(in_oklch,var(--mod-ia)_12%,white)] data-[modulo=ia]:text-mod-ia',
        secondary: 'bg-fila-hover text-texto-2',
        outline: 'border-borde text-texto-2',
      },
    },
    defaultVariants: {
      variant: 'exito',
    },
  },
)

function Badge({
  className,
  variant = 'exito',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span'

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
