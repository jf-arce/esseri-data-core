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
