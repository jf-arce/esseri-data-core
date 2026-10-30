import { apiClient } from '@/api/client'
import type { Borrador, Comunicacion } from '../types'

export function guardarBorrador(datos: Borrador, id?: string, docente = false) {
  const base = docente ? '/comunicaciones/docente' : '/comunicaciones'
  return apiClient<Comunicacion>(id ? `${base}/${id}` : base, {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
