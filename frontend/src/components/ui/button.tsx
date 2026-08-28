import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-colors outline-none select-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-violeta text-superficie hover:bg-violeta-esseri active:bg-violeta-pressed',
        secondary: 'border-borde bg-superficie text-texto hover:bg-fila-hover',
        ghost: 'text-texto-2 hover:bg-fila-hover hover:text-texto',
        destructive: 'bg-error-suave text-error hover:bg-[#F0CFCC]',
        link: 'text-violeta underline-offset-4 hover:underline',
      },
      size: {
        default:
          'h-9 gap-1.5 px-4.5 has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5',
        sm: 'h-8 gap-1 px-3 text-xs has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*=size-])]:size-3.5',
        lg: 'h-11 gap-2 px-5.5 text-sm has-data-[icon=inline-end]:pr-4.5 has-data-[icon=inline-start]:pl-4.5',
        icon: 'size-9',
        'icon-sm': 'size-8 [&_svg:not([class*=size-])]:size-3.5',
        'icon-lg': 'size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
