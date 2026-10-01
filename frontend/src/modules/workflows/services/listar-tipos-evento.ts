import { apiClient } from '@/api/client'
import type { TipoEvento } from '@/modules/workflows/types'

export function listarTiposEvento(signal?: AbortSignal) {
  return apiClient<TipoEvento[]>('/workflows/tipos-evento', { signal })
}
