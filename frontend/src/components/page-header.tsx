import type { ReactNode } from 'react'

interface PageHeaderProps {
  titulo: string
  accion?: ReactNode
}

export function PageHeader({ titulo, accion }: PageHeaderProps) {
  return (
    // `flex-wrap`: en un celular las acciones bajan debajo del título en vez de ensanchar la página.
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <h1 className="text-2xl font-semibold tracking-[-.01em] text-texto">{titulo}</h1>
      {accion}
    </div>
  )
}
