import { apiClient } from '@/api/client'
import type { Alumno, AlumnoUpdate } from '../types'

export function actualizarAlumno(id: string, datos: AlumnoUpdate) {
  return apiClient<Alumno>(`/familias-alumnos/alumnos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
