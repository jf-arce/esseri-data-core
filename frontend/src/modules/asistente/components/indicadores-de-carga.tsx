import { Trio } from 'ldrs/react'
import 'ldrs/react/Trio.css'
import { motion } from 'motion/react'

/** Loader de `ldrs` (tres puntos) mientras el asistente arma la respuesta. */
export function PuntosPensando() {
  return (
    <span className="flex items-center" aria-hidden="true">
      <Trio size={22} speed={1.3} color="var(--violeta)" />
    </span>
  )
}

/** Cursor parpadeante bajo el texto mientras la respuesta sigue llegando. */
export function CursorEscritura() {
  return (
    <motion.span
      className="h-4 w-0.5 rounded-full bg-violeta"
      aria-hidden="true"
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    />
  )
}
