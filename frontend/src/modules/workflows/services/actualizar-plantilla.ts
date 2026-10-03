import { apiClient } from '@/api/client'
import { apiPlantilla } from '@/modules/workflows/constants'
import type { PlantillaNotificacion, PlantillaPayload } from '@/modules/workflows/types'

export function actualizarPlantilla(id: string, datos: PlantillaPayload) {
  return apiClient<PlantillaNotificacion>(apiPlantilla(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
