import { descargarExport } from '@/lib/descargar-export'
import type { FiltrosInscripciones } from '@/modules/inscripciones/types'

type FiltrosExportacion = Pick<
  FiltrosInscripciones,
  'buscar' | 'cicloLectivo' | 'estado' | 'tipo' | 'ordenarPor' | 'direccion'
>

export function exportarInscripciones(filtros: FiltrosExportacion): Promise<void> {
  const parametros = new URLSearchParams()

  if (filtros.buscar?.trim()) parametros.set('buscar', filtros.buscar.trim())
  if (filtros.cicloLectivo) parametros.set('ciclo_lectivo', filtros.cicloLectivo)
  if (filtros.estado) parametros.set('estado', filtros.estado)
  if (filtros.tipo) parametros.set('tipo', filtros.tipo)
  if (filtros.ordenarPor) parametros.set('ordenar_por', filtros.ordenarPor)
  if (filtros.direccion) parametros.set('direccion', filtros.direccion)

  const query = parametros.toString()
  return descargarExport(`/inscripciones/exportar${query ? `?${query}` : ''}`, 'inscripciones.csv')
}
