import { cn } from '@/lib/utils'
import type { ComandoDeEntrada } from '../constants'

interface AtajoResaltadoProps {
  comando: ComandoDeEntrada
  className?: string
}

/** El atajo `/nombre` con su ícono, en violeta y sin fondo: igual en el campo y en el chat. */
export function AtajoResaltado({ comando, className }: AtajoResaltadoProps) {
  const Icono = comando.icono
  return (
    <span
      data-slot="atajo-resaltado"
      className={cn('inline-flex items-center gap-1 text-sm font-medium text-violeta', className)}
    >
      <Icono aria-hidden className="size-3.5" />/{comando.nombre}
    </span>
  )
}
