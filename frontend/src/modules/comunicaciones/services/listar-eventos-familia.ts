import { apiClient } from '@/api/client'
import type { EventoCalendario } from '../types'

export function listarEventosFamilia(
  alumnoId: string,
  desde: string,
  hasta: string,
  signal: AbortSignal,
) {
  const params = new URLSearchParams({ alumno_id: alumnoId, desde, hasta })
  return apiClient<EventoCalendario[]>(`/comunicaciones/familia/eventos?${params}`, { signal })
}
