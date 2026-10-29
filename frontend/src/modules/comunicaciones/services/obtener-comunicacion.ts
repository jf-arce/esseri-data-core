import { apiClient } from '@/api/client'
import type { Comunicacion } from '../types'
export function obtenerComunicacion(id: string, familia: boolean, signal?: AbortSignal) {
  return apiClient<Comunicacion>(`/comunicaciones${familia ? '/familia' : ''}/${id}`, { signal })
}
