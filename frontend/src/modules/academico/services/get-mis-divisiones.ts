import { apiClient } from '@/api/client'
import type { MiDivision } from '../types'

/** Divisiones asignadas al docente autenticado. Dato propio (GET /academico/docentes/me/…):
 * no requiere `academico.leer`, solo sesión. Usado por la pantalla "¿Cómo querés entrar?". */
export function getMisDivisiones(signal?: AbortSignal, cicloLectivo?: string) {
  const query = cicloLectivo ? `?ciclo_lectivo=${encodeURIComponent(cicloLectivo)}` : ''
  return apiClient<MiDivision[]>(`/academico/docentes/me/divisiones${query}`, { signal })
}
