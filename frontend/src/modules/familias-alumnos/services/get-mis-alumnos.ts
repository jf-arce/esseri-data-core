import { apiClient } from '@/api/client'
import type { MiAlumno } from '../types'

/** Alumnos a cargo del usuario autenticado. Dato propio (GET /familias-alumnos/familias/me/…):
 * no requiere `familias_alumnos.leer`, solo sesión. Usado por "¿Cómo querés entrar?". */
export function getMisAlumnos(signal?: AbortSignal) {
  return apiClient<MiAlumno[]>('/familias-alumnos/familias/me/alumnos', { signal })
}
