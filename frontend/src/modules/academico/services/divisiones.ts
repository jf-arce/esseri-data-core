import { apiClient } from '@/api/client'
import type { Division, DivisionCreate, DivisionUpdate } from '../types'

export function listarDivisiones(anioId?: string) {
  const params = anioId ? `?anio_id=${anioId}` : ''
  return apiClient<Division[]>(`/academico/divisiones${params}`)
}

export function obtenerDivision(id: string) {
  return apiClient<Division>(`/academico/divisiones/${id}`)
}

export function crearDivision(datos: DivisionCreate) {
  return apiClient<Division>('/academico/divisiones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

export function actualizarDivision(id: string, datos: DivisionUpdate) {
  return apiClient<Division>(`/academico/divisiones/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

export function eliminarDivision(id: string) {
  return apiClient<void>(`/academico/divisiones/${id}`, {
    method: 'DELETE',
  })
}
