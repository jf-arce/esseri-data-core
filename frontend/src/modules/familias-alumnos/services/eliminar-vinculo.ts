import { apiClient } from '@/api/client'

export function eliminarVinculo(id: string) {
  return apiClient<void>(`/familias-alumnos/vinculos/${id}`, {
    method: 'DELETE',
  })
}
