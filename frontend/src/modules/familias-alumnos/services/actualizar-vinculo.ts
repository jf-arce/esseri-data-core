import { apiClient } from '@/api/client'
import type { Vinculo, VinculoUpdate } from '../types'

export function actualizarVinculo(id: string, datos: VinculoUpdate) {
  return apiClient<Vinculo>(`/familias-alumnos/vinculos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
