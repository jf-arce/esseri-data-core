import { EnVivo } from '@/modules/workflows/components/en-vivo'

const FORMATO_HORA = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

/** Indicador "en vivo" del tablero y la hora de la última actualización de los datos. */
export function EstadoEnVivo({ actualizadoEn }: { actualizadoEn: Date | null }) {
  return (
    <div className="flex h-9 items-center gap-3 rounded-lg border border-borde bg-superficie px-3.5">
      <EnVivo />
      {actualizadoEn && (
        <span className="text-xs whitespace-nowrap text-texto-3">
          Actualizado <span className="tabular-nums">{FORMATO_HORA.format(actualizadoEn)}</span>
        </span>
      )}
    </div>
  )
}
