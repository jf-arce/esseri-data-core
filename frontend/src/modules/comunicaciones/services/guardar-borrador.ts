import { apiClient } from '@/api/client'
import type { Borrador, Comunicacion } from '../types'

export function guardarBorrador(datos: Borrador, id?: string) {
  return apiClient<Comunicacion>(id ? `/comunicaciones/${id}` : '/comunicaciones', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
