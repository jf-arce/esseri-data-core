import { apiClient } from '@/api/client'
import type { Alumno, AltaAlumnoCreate, AltaAlumnoResponse } from '../types'

export async function crearAlumno(datos: AltaAlumnoCreate): Promise<Alumno> {
  const response = await apiClient<AltaAlumnoResponse>('/familias-alumnos/alumnos/alta-completa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
  return response.alumno
}
