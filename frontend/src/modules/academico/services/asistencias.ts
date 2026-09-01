import { apiClient } from '@/api/client'
import type {
  Asistencia,
  AsistenciaBulkCreate,
  AsistenciaBulkResponse,
  AsistenciaCreate,
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
