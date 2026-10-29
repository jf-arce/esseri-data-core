import { apiClient } from '@/api/client'
import { descargarExport } from '@/lib/descargar-export'
import type { Asistencia, TipoAsistencia } from '../types'

export interface FiltrosHistorial {
  ciclo_lectivo: string
  nivel_educativo_id?: string
  anio_id?: string
  division_id?: string
  inscripcion_id?: string
  fecha_desde?: string
  fecha_hasta?: string
  estado?: TipoAsistencia
  orden?: 'fecha_desc' | 'fecha_asc' | 'alumno_asc' | 'alumno_desc'
  pagina?: number
  tamanio_pagina?: number
}

export interface PaginaHistorial {
  items: (Asistencia & { alumno: string; division: string })[]
  total: number
  pagina: number
  tamanio_pagina: number
  total_paginas: number
  resumen: {
    total_registros: number
    presentes: number
    ausentes_justificadas: number
    ausentes_injustificadas: number
    porcentaje_presencia: number
  }
}

export interface OpcionHistorial {
  inscripcion_id: string
  alumno: string
  division_id: string
  division: string
  anio_id: string
  anio: number
  nivel_educativo_id: string
  nivel: string
}

function parametros(filtros: FiltrosHistorial, exportacion = false) {
  const params = new URLSearchParams()
  for (const [clave, valor] of Object.entries(filtros)) {
    if (exportacion && (clave === 'pagina' || clave === 'tamanio_pagina')) continue
    if (valor !== undefined && valor !== '') params.set(clave, String(valor))
  }
  return params
}

export function consultarHistorial(filtros: FiltrosHistorial) {
  return apiClient<PaginaHistorial>(`/academico/asistencias/consulta?${parametros(filtros)}`)
}

export function obtenerOpcionesHistorial(cicloLectivo: string) {
  return apiClient<OpcionHistorial[]>(
    `/academico/asistencias/filtros?ciclo_lectivo=${encodeURIComponent(cicloLectivo)}`,
  )
}

export function exportarHistorial(filtros: FiltrosHistorial, formato: 'csv' | 'xlsx' | 'pdf') {
  const params = parametros(filtros, true)
  params.set('formato', formato)
  return descargarExport(
    `/academico/asistencias/consulta/exportar?${params}`,
    `asistencias_${filtros.ciclo_lectivo}.${formato}`,
  )
}

export function obtenerCiclosHistorial() {
  return apiClient<string[]>('/academico/asistencias/ciclos')
}
