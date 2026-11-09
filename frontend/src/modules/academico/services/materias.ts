import { apiClient } from '@/api/client'
import type { Materia, MateriaCreate, MateriaUpdate } from '../types'

export function listarMaterias() {
  return apiClient<Materia[]>('/academico/materias')
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
