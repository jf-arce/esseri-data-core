import type { ReactNode } from 'react'

interface PageHeaderProps {
  titulo: string
  accion?: ReactNode
}

export function PageHeader({ titulo, accion }: PageHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-6">
      <h1 className="text-2xl font-semibold tracking-[-.01em] text-texto">{titulo}</h1>
      {accion}
    </div>
  )
}
