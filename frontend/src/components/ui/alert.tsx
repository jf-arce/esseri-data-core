import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

// Banner de error de operación (§9.8) y resumen de errores de formulario (§9.7): caja persistente
// en la página, no un toast. Snackbar (Sonner) es para la confirmación transitoria de una acción.
const alertVariants = cva(
  "group/alert relative grid w-full gap-1 rounded-card-sm border px-4 py-3.5 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-3 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        error: 'border-error/30 bg-error-suave text-error',
        advertencia: 'border-advertencia/30 bg-advertencia-suave text-advertencia',
        info: 'border-info/30 bg-info-suave text-info',
      },
    },
    defaultVariants: {
      variant: 'error',
    },
  },
)

function Alert({
  className,
  variant = 'error',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        'text-[13px] font-bold group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3',
        className,
      )}
      {...props}
    />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        'text-[13px] text-balance opacity-90 md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a:hover]:no-underline [&_p:not(:last-child)]:mb-4',
        className,
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="alert-action" className={cn('absolute top-2 right-2', className)} {...props} />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
