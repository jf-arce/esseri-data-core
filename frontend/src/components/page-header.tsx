import type { ReactNode } from 'react'

interface PageHeaderProps {
  titulo: string
  accion?: ReactNode
  // Versalitas sobre el título (DESIGN.md §3) para ubicar al usuario en el área.
  etiqueta?: string
  descripcion?: string
}

export function PageHeader({ titulo, accion, etiqueta, descripcion }: PageHeaderProps) {
  return (
    // `flex-wrap`: en un celular las acciones bajan debajo del título en vez de ensanchar la página.
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {etiqueta && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[.08em] text-violeta">
            {etiqueta}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-[-.01em] text-texto">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-texto-2">{descripcion}</p>}
      </div>
      {accion}
    </div>
  )
}
