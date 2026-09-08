import { apiClient } from '@/api/client'
import type { Familia, FiltrosListarFamilias } from '../types'

export function listarFamilias(filtros?: FiltrosListarFamilias) {
  const params = new URLSearchParams()
  if (filtros?.buscar) params.set('buscar', filtros.buscar)
  if (filtros?.estado_deuda) params.set('estado_deuda', filtros.estado_deuda)
  const qs = params.toString() ? `?${params.toString()}` : ''
  return apiClient<Familia[]>(`/familias-alumnos/familias${qs}`)
}
