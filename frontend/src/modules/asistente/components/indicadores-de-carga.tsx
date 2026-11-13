import { DotWave } from 'ldrs/react'
import 'ldrs/react/DotWave.css'
import { motion } from 'motion/react'

/** Loader de `ldrs` (ondas de puntos) mientras el asistente arma la respuesta. */
export function PuntosPensando() {
  return (
    <span className="flex items-center" aria-hidden="true">
      <DotWave size={32} speed={1.1} color="var(--violeta)" />
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
