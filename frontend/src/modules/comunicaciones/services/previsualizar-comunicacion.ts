import { apiClient } from '@/api/client'
import type { Borrador } from '../types'
export function previsualizarComunicacion(datos: Borrador, docente = false) {
  return apiClient<{ destinatarios: number }>(
    docente ? '/comunicaciones/docente/vista-previa' : '/comunicaciones/vista-previa',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    },
  )
}
