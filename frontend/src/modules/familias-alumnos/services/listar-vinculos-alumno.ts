import { apiClient } from '@/api/client'
import type { Vinculo } from '../types'

export function listarVinculosAlumno(alumnoId: string) {
  return apiClient<Vinculo[]>(`/familias-alumnos/alumnos/${alumnoId}/vinculos`)
}
