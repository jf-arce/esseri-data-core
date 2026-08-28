import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

// Estado vacío (§9.4): ícono en tile circular de 52px, título, descripción y solo cuando hay algo
// que crear o resolver, un botón de acción debajo. Un vacío que es buena noticia no lleva botón.
function Empty({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty"
      className={cn(
        'flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-balance',
        className,
      )}
      {...props}
    />
  )
}

function EmptyHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-header"
      className={cn('flex max-w-sm flex-col items-center gap-3', className)}
      {...props}
    />
  )
}

const emptyMediaVariants = cva(
  'mb-1 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        // Ícono en tile circular de 52px (§9.4). El color lo elige quien lo usa según el módulo o
        // semántico de la pantalla, ej. className="bg-violeta-suave text-violeta".
        icon: "flex size-13 shrink-0 items-center justify-center rounded-full [&_svg:not([class*='size-'])]:size-6",
        // Pantalla sin permiso (§9.6): siempre neutro, nunca color de módulo o semántico.
        neutral:
          "flex size-13 shrink-0 items-center justify-center rounded-full bg-fila-hover text-texto-3 [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function EmptyMedia({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      className={cn(emptyMediaVariants({ variant, className }))}
      {...props}
    />
  )
}

function EmptyTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-title"
      className={cn('font-heading text-[14px] font-semibold text-texto', className)}
      {...props}
    />
  )
}

function EmptyDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <div
      data-slot="empty-description"
      className={cn(
        'max-w-[280px] text-[13px] leading-relaxed text-texto-2 [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-violeta',
        className,
      )}
      {...props}
    />
  )
}

function EmptyContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-content"
      className={cn(
        'flex w-full max-w-sm min-w-0 flex-col items-center gap-2.5 text-sm text-balance',
        className,
      )}
      {...props}
    />
  )
}

export { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia }
