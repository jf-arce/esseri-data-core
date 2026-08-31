import { apiClient } from '@/api/client'
import type { Materia, MateriaCreate, MateriaUpdate } from '../types'

export function listarMaterias(anioId?: string, divisionId?: string) {
  const params = new URLSearchParams()
  if (divisionId) params.set('division_id', divisionId)
  if (anioId) params.set('anio_id', anioId)
  const qs = params.toString() ? `?${params.toString()}` : ''
  return apiClient<Materia[]>(`/academico/materias${qs}`)
}

export function obtenerMateria(id: string) {
  return apiClient<Materia>(`/academico/materias/${id}`)
}

export function crearMateria(datos: MateriaCreate) {
  return apiClient<Materia>('/academico/materias', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

export function actualizarMateria(id: string, datos: MateriaUpdate) {
  return apiClient<Materia>(`/academico/materias/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

export function eliminarMateria(id: string) {
  return apiClient<void>(`/academico/materias/${id}`, {
    method: 'DELETE',
  })
}
