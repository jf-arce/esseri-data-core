import { apiClient } from '@/api/client'
import type { Borrador } from '../types'
export function previsualizarComunicacion(datos: Borrador) {
  return apiClient<{ destinatarios: number }>('/comunicaciones/vista-previa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
