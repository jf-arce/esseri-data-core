import { apiClient } from '@/api/client'
import type { Asistencia } from '../types'

export function listarAsistenciasFamilia(alumnoId: string) {
  return apiClient<Asistencia[]>(`/academico/familia/alumnos/${alumnoId}/asistencias`)
}
