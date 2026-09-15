import { apiClient } from '@/api/client'
import { descargarExport } from '@/lib/descargar-export'
import type {
  Asistencia,
  AsistenciaBulkCreate,
  AsistenciaBulkResponse,
  AsistenciaCreate,
  AsistenciaResumen,
  AsistenciaUpdate,
} from '../types'

export interface FiltrosAsistencia {
  inscripcion_id?: string
  fecha?: string
  fecha_desde?: string
  fecha_hasta?: string
  division_id?: string
}

export function listarAsistencias(filtros?: FiltrosAsistencia) {
  const params = new URLSearchParams()
  if (filtros?.inscripcion_id) params.set('inscripcion_id', filtros.inscripcion_id)
  if (filtros?.fecha) params.set('fecha', filtros.fecha)
  if (filtros?.fecha_desde) params.set('fecha_desde', filtros.fecha_desde)
  if (filtros?.fecha_hasta) params.set('fecha_hasta', filtros.fecha_hasta)
  if (filtros?.division_id) params.set('division_id', filtros.division_id)
  const qs = params.toString() ? `?${params.toString()}` : ''
  return apiClient<Asistencia[]>(`/academico/asistencias${qs}`)
}

export function crearAsistencia(datos: AsistenciaCreate) {
  return apiClient<Asistencia>('/academico/asistencias', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

export function actualizarAsistencia(id: string, datos: AsistenciaUpdate) {
  return apiClient<Asistencia>(`/academico/asistencias/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

export function eliminarAsistencia(id: string) {
  return apiClient<void>(`/academico/asistencias/${id}`, {
    method: 'DELETE',
  })
}

export function registrarAsistenciaMasiva(datos: AsistenciaBulkCreate) {
  return apiClient<AsistenciaBulkResponse>('/academico/asistencias/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

export interface FiltrosResumenAsistencia {
  inscripcion_id: string
  fecha_desde: string
  fecha_hasta: string
}

export function obtenerResumenAsistencia(filtros: FiltrosResumenAsistencia) {
  const params = new URLSearchParams({
    inscripcion_id: filtros.inscripcion_id,
    fecha_desde: filtros.fecha_desde,
    fecha_hasta: filtros.fecha_hasta,
  })
  return apiClient<AsistenciaResumen>(`/academico/asistencias/resumen?${params.toString()}`)
}

export type FormatoExportacion = 'csv' | 'xlsx' | 'pdf'

export interface FiltrosExportarAsistencias {
  fecha_desde: string
  fecha_hasta: string
  formato: FormatoExportacion
  division_id?: string
}

// RF-37: a diferencia del resto de este archivo, el endpoint devuelve un archivo, no JSON —
// `descargarExport` maneja la descarga (ver `src/lib/descargar-export.ts`, ya usado por
// Facturación para el PDF de factura).
export function exportarAsistencias(filtros: FiltrosExportarAsistencias) {
  const params = new URLSearchParams({
    fecha_desde: filtros.fecha_desde,
    fecha_hasta: filtros.fecha_hasta,
    formato: filtros.formato,
  })
  if (filtros.division_id) params.set('division_id', filtros.division_id)
  return descargarExport(
    `/academico/asistencias/exportar?${params.toString()}`,
    `asistencias_${filtros.fecha_desde}_${filtros.fecha_hasta}.${filtros.formato}`,
  )
}
