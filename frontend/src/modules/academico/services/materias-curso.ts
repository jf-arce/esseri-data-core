import { apiClient } from '@/api/client'
import type {
  MateriaCurso,
  MateriaCursoCreate,
  MateriaCursoUpdate,
  MateriaSinDocente,
} from '../types'

export interface FiltrosMateriaCurso {
  division_id?: string
  anio_id?: string
  materia_id?: string
  nivel_educativo_id?: string
}

export function listarMateriasCurso(filtros?: FiltrosMateriaCurso) {
  const params = new URLSearchParams()
  if (filtros?.division_id) params.set('division_id', filtros.division_id)
  if (filtros?.anio_id) params.set('anio_id', filtros.anio_id)
  if (filtros?.materia_id) params.set('materia_id', filtros.materia_id)
  if (filtros?.nivel_educativo_id) params.set('nivel_educativo_id', filtros.nivel_educativo_id)
  const qs = params.toString() ? `?${params.toString()}` : ''
  return apiClient<MateriaCurso[]>(`/academico/materias-curso${qs}`)
}

export function listarMateriasSinDocente(cicloLectivo: string) {
  return apiClient<MateriaSinDocente[]>(
    `/academico/materias-curso/sin-docente?ciclo_lectivo=${encodeURIComponent(cicloLectivo)}`,
  )
}

export function obtenerMateriaCurso(id: string) {
  return apiClient<MateriaCurso>(`/academico/materias-curso/${id}`)
}

export function crearMateriaCurso(datos: MateriaCursoCreate) {
  return apiClient<MateriaCurso>('/academico/materias-curso', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

export function actualizarMateriaCurso(id: string, datos: MateriaCursoUpdate) {
  return apiClient<MateriaCurso>(`/academico/materias-curso/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

export function eliminarMateriaCurso(id: string) {
  return apiClient<void>(`/academico/materias-curso/${id}`, {
    method: 'DELETE',
  })
}
