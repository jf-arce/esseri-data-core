import { apiClient } from '@/api/client'
import type { MateriaCurso } from '@/modules/academico/types'

/** Horario semanal del curso activo de un alumno a cargo de la familia autenticada.
 * Solo lectura: el Portal Familia no expone el ABM de estructura académica. */
export function getHorarioFamilia(alumnoId: string, signal?: AbortSignal) {
  return apiClient<MateriaCurso[]>(`/academico/familia/alumnos/${alumnoId}/horario`, { signal })
}
