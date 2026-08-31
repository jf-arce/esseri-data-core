import { apiClient } from '@/api/client'
import type { Alumno } from '../types'

export function obtenerAlumno(id: string) {
  return apiClient<Alumno>(`/familias-alumnos/alumnos/${id}`)
}
