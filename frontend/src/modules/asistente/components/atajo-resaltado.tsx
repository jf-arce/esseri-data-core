import type { Ref } from 'react'
import { cn } from '@/lib/utils'
import type { ComandoDeEntrada } from '../constants'

interface AtajoResaltadoProps {
  comando: ComandoDeEntrada
  className?: string
  ref?: Ref<HTMLSpanElement>
}

/** El atajo con su ícono, en violeta y sin fondo: igual en el campo y en el chat. */
export function AtajoResaltado({ comando, className, ref }: AtajoResaltadoProps) {
  const Icono = comando.icono
  return (
    <span
      ref={ref}
      data-slot="atajo-resaltado"
      className={cn('inline-flex items-center gap-1 text-sm font-medium text-violeta', className)}
    >
      <Icono aria-hidden className="size-3.5" />{comando.nombre}
    </span>
  )
}
