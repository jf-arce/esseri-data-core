import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-9 w-full min-w-0 rounded-lg border border-borde bg-superficie px-3 py-1 text-sm text-texto transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-texto placeholder:text-desactivado disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-fila-hover disabled:text-desactivado disabled:opacity-100 aria-invalid:border-error',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
