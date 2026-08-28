import * as React from 'react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from 'lucide-react'

// Pie de la card de tabla (§9.1/§9 DESIGN.md): fila propia dentro de la misma card, contador
// a la izquierda, píldoras de página a la derecha — no un elemento centrado y suelto.
function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      role="navigation"
      aria-label="Paginación"
      data-slot="pagination"
      className={cn('flex w-full items-center justify-between px-6 py-4', className)}
      {...props}
    />
  )
}

// "1-8 de 142 usuarios": el contador que acompaña a la paginación, siempre a su izquierda.
function PaginationCount({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="pagination-count"
      className={cn('text-xs text-texto-3', className)}
      {...props}
    />
  )
}

function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn('flex items-center gap-0.5', className)}
      {...props}
    />
  )
}

function PaginationItem({ ...props }: React.ComponentProps<'li'>) {
  return <li data-slot="pagination-item" {...props} />
}

type PaginationLinkProps = {
  isActive?: boolean
} & Pick<React.ComponentProps<typeof Button>, 'size'> &
  React.ComponentProps<'a'>

function PaginationLink({ className, isActive, size = 'icon-sm', ...props }: PaginationLinkProps) {
  return (
    <Button
      asChild
      variant={isActive ? 'default' : 'ghost'}
      size={size}
      className={cn('font-semibold tabular-nums', className)}
    >
      {/* Sin href real (la paginación cambia estado de página en el cliente, no navega): se
          fija tabIndex para que siga siendo alcanzable por teclado, ya que un <a> sin href
          queda fuera del orden de tabulación por defecto. */}
      <a
        aria-current={isActive ? 'page' : undefined}
        data-slot="pagination-link"
        data-active={isActive}
        tabIndex={0}
        {...props}
      />
    </Button>
  )
}

function PaginationPrevious({
  className,
  text = 'Anterior',
  ...props
}: React.ComponentProps<typeof PaginationLink> & { text?: string }) {
  return (
    <PaginationLink
      aria-label="Ir a la página anterior"
      size="default"
      className={cn('pl-1.5!', className)}
      {...props}
    >
      <ChevronLeftIcon data-icon="inline-start" />
      <span className="hidden sm:block">{text}</span>
    </PaginationLink>
  )
}

function PaginationNext({
  className,
  text = 'Siguiente',
  ...props
}: React.ComponentProps<typeof PaginationLink> & { text?: string }) {
  return (
    <PaginationLink
      aria-label="Ir a la página siguiente"
      size="default"
      className={cn('pr-1.5!', className)}
      {...props}
    >
      <span className="hidden sm:block">{text}</span>
      <ChevronRightIcon data-icon="inline-end" />
    </PaginationLink>
  )
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn(
        "flex size-8 items-center justify-center [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <MoreHorizontalIcon />
      <span className="sr-only">Más páginas</span>
    </span>
  )
}

export {
  Pagination,
  PaginationCount,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
}
