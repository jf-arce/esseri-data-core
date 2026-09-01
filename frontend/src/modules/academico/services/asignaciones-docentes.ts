import { apiClient } from '@/api/client'
import type { AsignacionDocente, AsignacionDocenteCreate } from '../types'

export interface FiltrosAsignacion {
  ciclo_lectivo?: string
  docente_id?: string
  materia_id?: string
  division_id?: string
}

export function listarAsignaciones(filtros?: FiltrosAsignacion) {
  const params = new URLSearchParams()
  if (filtros?.ciclo_lectivo) params.set('ciclo_lectivo', filtros.ciclo_lectivo)
  if (filtros?.docente_id) params.set('docente_id', filtros.docente_id)
  if (filtros?.materia_id) params.set('materia_id', filtros.materia_id)
  if (filtros?.division_id) params.set('division_id', filtros.division_id)
  const qs = params.toString() ? `?${params.toString()}` : ''
  return apiClient<AsignacionDocente[]>(`/academico/asignaciones-docentes${qs}`)
}

export function crearAsignacion(datos: AsignacionDocenteCreate) {
  return apiClient<AsignacionDocente>('/academico/asignaciones-docentes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

export function eliminarAsignacion(id: string) {
  return apiClient<void>(`/academico/asignaciones-docentes/${id}`, {
    method: 'DELETE',
  })
}
