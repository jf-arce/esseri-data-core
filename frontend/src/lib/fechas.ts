export const ZONA_HORARIA_ARGENTINA = 'America/Argentina/Buenos_Aires'

const formatoFechaHora = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: ZONA_HORARIA_ARGENTINA,
})

const formatoDia = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: ZONA_HORARIA_ARGENTINA,
})

/** Instante de la API (ISO 8601 UTC) en hora de Buenos Aires, 24 h. `—` si falta o es inválido. */
export function formatearFechaHora(iso: string | null): string {
  if (!iso) return '—'
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  return formatoFechaHora.format(fecha)
}

/** Día (en hora de Buenos Aires) de un instante. Para fechas de solo día no se usa. */
export function formatearDiaDeInstante(iso: string): string {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  return formatoDia.format(fecha)
}
