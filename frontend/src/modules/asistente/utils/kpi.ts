import type { BloqueKpi } from '../types'
import { sinTildes } from './entrada'

export function formatearKpi(bloque: BloqueKpi): string {
  if (bloque.valor === null) return 'Sin registros'
  if (typeof bloque.valor === 'string') return bloque.valor
  const numero = bloque.valor.toLocaleString('es-AR')
  if (bloque.unidad === '$') return `$ ${numero}`
  return bloque.unidad === '' ? numero : `${numero} ${bloque.unidad}`
}

export type TonoKpi = 'bueno' | 'malo' | 'neutro'

/** Color de un indicador: bueno si la variación va hacia donde es mejor, malo si va al revés. */
export function tonoDeKpi(bloque: BloqueKpi): TonoKpi {
  const variacion = bloque.variacion
  if (variacion === null || variacion === undefined || variacion === 0) return 'neutro'
  if (bloque.mejora === undefined) return 'neutro'
  return (bloque.mejora === 'alza') === variacion > 0 ? 'bueno' : 'malo'
}

export type IconoKpi =
  'dinero' | 'deuda' | 'ausentes' | 'inscripciones' | 'alumnos' | 'tareas' | 'compras' | 'general'

/** Qué ícono lleva un indicador, según de qué trata (por su título y su unidad). */
export function iconoDeKpi(bloque: BloqueKpi): IconoKpi {
  const titulo = sinTildes(bloque.titulo)
  if (titulo.includes('deuda')) return 'deuda'
  if (bloque.unidad === '$') return 'dinero'
  if (titulo.includes('ausente') || titulo.includes('inasisten')) return 'ausentes'
  if (titulo.includes('inscripci')) return 'inscripciones'
  if (titulo.includes('alumno')) return 'alumnos'
  if (titulo.includes('tarea')) return 'tareas'
  if (titulo.includes('solicitud') || titulo.includes('compra')) return 'compras'
  return 'general'
}
