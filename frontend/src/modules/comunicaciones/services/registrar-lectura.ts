import { apiClient } from '@/api/client'
import type { Comunicacion } from '../types'
export function registrarLectura(id: string) {
  return apiClient<Comunicacion>(`/comunicaciones/familia/${id}/lectura`, { method: 'PUT' })
}
