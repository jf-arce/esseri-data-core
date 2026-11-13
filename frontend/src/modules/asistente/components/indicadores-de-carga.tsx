import { motion } from 'motion/react'

/** Tres puntos que rebotan en cadena mientras el asistente arma la respuesta. */
export function PuntosPensando() {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((indice) => (
        <motion.span
          key={indice}
          className="size-1.5 rounded-full bg-violeta"
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: indice * 0.15, ease: 'easeInOut' }}
        />
      ))}
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
