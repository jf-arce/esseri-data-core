import { apiClient } from '@/api/client'
import { API_PLANTILLAS } from '@/modules/workflows/constants'
import type { PlantillaNotificacion } from '@/modules/workflows/types'

/** Solo las plantillas compatibles con el evento (sus campos cubren los placeholders). */
export function listarPlantillas(tipoEventoId: string, signal?: AbortSignal) {
  const parametros = new URLSearchParams({ tipo_evento_id: tipoEventoId })
  return apiClient<PlantillaNotificacion[]>(`${API_PLANTILLAS}?${parametros.toString()}`, {
    signal,
  })
}
