import { apiClient } from '@/api/client'
import type { Vinculo, VinculoCreate } from '../types'

export function crearVinculo(datos: VinculoCreate) {
  return apiClient<Vinculo>('/familias-alumnos/vinculos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
