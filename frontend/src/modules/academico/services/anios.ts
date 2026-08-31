import { apiClient } from '@/api/client'
import type { Anio, AnioCreate, AnioUpdate } from '../types'

export function listarAnios(nivelEducativoId?: string) {
  const params = nivelEducativoId ? `?nivel_educativo_id=${nivelEducativoId}` : ''
  return apiClient<Anio[]>(`/academico/anios${params}`)
}

export function obtenerAnio(id: string) {
  return apiClient<Anio>(`/academico/anios/${id}`)
}

export function crearAnio(datos: AnioCreate) {
  return apiClient<Anio>('/academico/anios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

export function actualizarAnio(id: string, datos: AnioUpdate) {
  return apiClient<Anio>(`/academico/anios/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

export function eliminarAnio(id: string) {
  return apiClient<void>(`/academico/anios/${id}`, {
    method: 'DELETE',
  })
}
