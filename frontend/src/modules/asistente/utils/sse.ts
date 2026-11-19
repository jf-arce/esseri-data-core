import type { EventoSse } from '../types'

const EVENTOS_CONOCIDOS = new Set(['herramienta', 'texto', 'tarjeta', 'navegar', 'fin', 'error'])

/**
 * Parser incremental de Server-Sent Events. Recibe el texto acumulado (`pendiente`) más el
 * fragmento nuevo y devuelve los eventos completos y el resto sin terminar. Ignora eventos que
 * no conoce y datos que no son JSON.
 */
export function parsearSse(
  pendiente: string,
  fragmento: string,
): { eventos: EventoSse[]; resto: string } {
  const texto = (pendiente + fragmento).replace(/\r\n/g, '\n')
  const bloques = texto.split('\n\n')
  const resto = bloques.pop() ?? ''
  const eventos: EventoSse[] = []
  for (const bloque of bloques) {
    let nombre = 'message'
    const datos: string[] = []
    for (const linea of bloque.split('\n')) {
      if (linea.startsWith('event:')) nombre = linea.slice(6).trim()
      else if (linea.startsWith('data:')) datos.push(linea.slice(5).trimStart())
    }
    if (!EVENTOS_CONOCIDOS.has(nombre) || datos.length === 0) continue
    try {
      const parseado: unknown = JSON.parse(datos.join('\n'))
      if (typeof parseado === 'object' && parseado !== null) {
        eventos.push({ evento: nombre, datos: parseado } as EventoSse)
      }
    } catch {
      continue
    }
  }
  return { eventos, resto }
}
