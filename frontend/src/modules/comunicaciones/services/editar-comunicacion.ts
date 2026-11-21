import { apiClient } from '@/api/client'
import type { Comunicacion } from '../types'

export function editarPublicacion(
  id: string,
  datos: Pick<Comunicacion, 'asunto' | 'cuerpo' | 'cuerpo_rico' | 'version'>,
) {
  return apiClient<Comunicacion>(`/comunicaciones/${id}/contenido`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

export function eliminarBorrador(id: string, version: number) {
  return apiClient<void>(`/comunicaciones/${id}?version=${version}`, { method: 'DELETE' })
}
