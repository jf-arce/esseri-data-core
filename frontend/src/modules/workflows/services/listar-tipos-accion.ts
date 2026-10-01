import { apiClient } from '@/api/client'
import type { TipoAccionCatalogo } from '@/modules/workflows/types'

export function listarTiposAccion(signal?: AbortSignal) {
  return apiClient<TipoAccionCatalogo[]>('/workflows/tipos-accion', { signal })
}
