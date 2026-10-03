import { apiClient } from '@/api/client'
import { apiDestinatariosRegla } from '@/modules/workflows/constants'
import type { DestinatariosRegla } from '@/modules/workflows/types'

export function obtenerDestinatariosRegla(reglaId: string, signal?: AbortSignal) {
  return apiClient<DestinatariosRegla>(apiDestinatariosRegla(reglaId), { signal })
}
