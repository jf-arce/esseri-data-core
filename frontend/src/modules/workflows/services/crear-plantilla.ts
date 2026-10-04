import { apiClient } from '@/api/client'
import { API_PLANTILLAS } from '@/modules/workflows/constants'
import type { PlantillaNotificacion, PlantillaPayload } from '@/modules/workflows/types'

export function crearPlantilla(datos: PlantillaPayload) {
  return apiClient<PlantillaNotificacion>(API_PLANTILLAS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
