const mismoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

/**
 * Hora contextual en la zona del navegador: el backend entrega un instante con offset, así que
 * "Hoy" y "Ayer" se resuelven contra la hora local de quien mira el panel, no contra UTC.
 */
export function fechaActividad(valor: string, ahora = new Date()) {
  const fecha = new Date(valor)
  const ayer = new Date(ahora)
  ayer.setDate(ayer.getDate() - 1)
  const hora = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  if (mismoDia(fecha, ahora)) return `Hoy · ${hora}`
  if (mismoDia(fecha, ayer)) return `Ayer · ${hora}`
  // Formato numérico y no `month: 'short'`: la abreviatura de es-AR rinde "01-oct", que no
  // coincide con el "dd/mm/aaaa" que ya usa Facturación en el resto de la app.
  return `${fecha.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })} · ${hora}`
}

const DIA_MS = 86_400_000

/** Días enteros entre una fecha `AAAA-MM-DD` y hoy, en calendario local (nunca negativo). */
export function diasDesde(fecha: string, ahora = new Date()) {
  const [anio, mes, dia] = fecha.slice(0, 10).split('-').map(Number)
  const origen = Date.UTC(anio, mes - 1, dia)
  const hoy = Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  return Math.max(0, Math.round((hoy - origen) / DIA_MS))
}

export function antiguedad(dias: number) {
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'hace 1 día'
  return `hace ${dias} días`
}

/** Porcentaje cobrado sobre lo facturado, o `null` si no se facturó nada. */
export function porcentajeCobranza(facturado: number, cobrado: number) {
  return facturado > 0 ? (cobrado / facturado) * 100 : null
}

/** Variación porcentual entre dos períodos, o `null` si la base es cero. */
export function variacionPorcentual(actual: number, anterior: number) {
  return anterior > 0 ? ((actual - anterior) / anterior) * 100 : null
}
