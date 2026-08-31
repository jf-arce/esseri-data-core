import { apiClient } from '@/api/client'
import type { Vinculo } from '../types'

export function listarVinculosFamilia(familiaId: string) {
  return apiClient<Vinculo[]>(`/familias-alumnos/familias/${familiaId}/vinculos`)
}
