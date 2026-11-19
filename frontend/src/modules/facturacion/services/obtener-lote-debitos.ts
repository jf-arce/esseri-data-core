import { apiClient } from '@/api/client'
import type { LoteDebitoDetalle } from '@/modules/facturacion/types'

export function obtenerLoteDebitos(loteId: string, signal?: AbortSignal) {
  return apiClient<LoteDebitoDetalle>(`/facturacion/cobranzas-simuladas/${loteId}`, { signal })
}
