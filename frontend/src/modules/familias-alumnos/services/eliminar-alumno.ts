import { apiClient } from '@/api/client'

export function eliminarAlumno(id: string) {
  return apiClient<void>(`/familias-alumnos/alumnos/${id}`, {
    method: 'DELETE',
  })
}
