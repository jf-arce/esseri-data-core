import { useEffect, useState } from 'react'
import { EnVivo } from '@/modules/workflows/components/en-vivo'

const FORMATO_HORA = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

/** Reloj digital del tablero: la hora actual, y debajo la de la última actualización de los
 * datos, para saber qué tan fresco es lo que se ve. */
export function RelojPanel({ actualizadoEn }: { actualizadoEn: Date | null }) {
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const temporizador = setInterval(() => setAhora(new Date()), 1000)
    return () => clearInterval(temporizador)
  }, [])

  return (
    <div className="flex h-9 items-center gap-3 rounded-lg border border-borde bg-superficie px-3.5 shadow-card">
      <EnVivo />
      <span
        role="timer"
        aria-label="Hora actual"
        className="font-mono text-base font-semibold tracking-wider text-texto tabular-nums"
      >
        {FORMATO_HORA.format(ahora)}
      </span>
      {actualizadoEn && (
        <span className="hidden border-l border-borde pl-3 text-xs whitespace-nowrap text-texto-3 sm:inline">
          Actualizado <span className="tabular-nums">{FORMATO_HORA.format(actualizadoEn)}</span>
        </span>
      )}
    </div>
  )
}
