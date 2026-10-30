import { apiClient } from '@/api/client'
import type { Comunicacion } from '../types'
export function publicarComunicacion(id: string, docente = false) {
  const base = docente ? '/comunicaciones/docente' : '/comunicaciones'
  return apiClient<Comunicacion>(`${base}/${id}/publicar`, { method: 'POST' })
}
