import { apiClient } from '@/api/client'
import type { AsistenciaFamilia } from '../types'

export function listarAsistenciasFamilia(alumnoId: string) {
  return apiClient<AsistenciaFamilia[]>(`/academico/familia/alumnos/${alumnoId}/asistencias`)
}
