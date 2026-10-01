import { apiClient } from '@/api/client'
import { API_TIPOS_ACCION } from '@/modules/workflows/constants'
import type { TipoAccionCatalogo } from '@/modules/workflows/types'

export function listarTiposAccion(signal?: AbortSignal) {
  return apiClient<TipoAccionCatalogo[]>(API_TIPOS_ACCION, { signal })
}
