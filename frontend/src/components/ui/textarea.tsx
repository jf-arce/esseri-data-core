import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 w-full rounded-lg border border-borde bg-superficie px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-desactivado focus-visible:border-violeta disabled:cursor-not-allowed disabled:bg-fila-hover disabled:text-desactivado disabled:opacity-100 aria-invalid:border-error',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
