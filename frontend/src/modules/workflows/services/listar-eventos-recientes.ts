import { apiClient } from '@/api/client'
import { API_EVENTOS_RECIENTES } from '@/modules/workflows/constants'
import type { EventoResumen } from '@/modules/workflows/types'

export function listarEventosRecientes(tipoEventoId: string, signal?: AbortSignal) {
  const parametros = new URLSearchParams({ tipo_evento_id: tipoEventoId })
  return apiClient<EventoResumen[]>(`${API_EVENTOS_RECIENTES}?${parametros.toString()}`, { signal })
}
