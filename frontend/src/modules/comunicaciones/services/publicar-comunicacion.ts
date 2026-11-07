import { apiClient } from '@/api/client'
import type { Comunicacion } from '../types'
export function publicarComunicacion(id: string, version: number, docente = false) {
  const base = docente ? '/comunicaciones/docente' : '/comunicaciones'
  return apiClient<Comunicacion>(`${base}/${id}/publicar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version }),
  })
}
