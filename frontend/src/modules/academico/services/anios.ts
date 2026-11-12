import { apiClient } from '@/api/client'
import type { Anio } from '../types'

export function listarAnios(nivelEducativoId?: string) {
  const params = nivelEducativoId ? `?nivel_educativo_id=${nivelEducativoId}` : ''
  return apiClient<Anio[]>(`/academico/anios${params}`)
}

export function obtenerAnio(id: string) {
  return apiClient<Anio>(`/academico/anios/${id}`)
}

export function eliminarAnio(id: string) {
  return apiClient<void>(`/academico/anios/${id}`, {
    method: 'DELETE',
  })
}
