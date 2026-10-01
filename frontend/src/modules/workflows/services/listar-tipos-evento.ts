import { apiClient } from '@/api/client'
import { API_TIPOS_EVENTO } from '@/modules/workflows/constants'
import type { TipoEvento } from '@/modules/workflows/types'

export function listarTiposEvento(signal?: AbortSignal) {
  return apiClient<TipoEvento[]>(API_TIPOS_EVENTO, { signal })
}
