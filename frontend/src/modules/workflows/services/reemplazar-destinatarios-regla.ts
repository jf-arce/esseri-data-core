import { apiClient } from '@/api/client'
import { apiDestinatariosRegla } from '@/modules/workflows/constants'
import type { DestinatariosRegla, DestinatariosReglaPayload } from '@/modules/workflows/types'

export function reemplazarDestinatariosRegla(reglaId: string, datos: DestinatariosReglaPayload) {
  return apiClient<DestinatariosRegla>(apiDestinatariosRegla(reglaId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
