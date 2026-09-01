import { apiClient } from '@/api/client'
import type { FacturaDetalle } from '@/modules/facturacion/types'

export function obtenerFactura(facturaId: string, signal?: AbortSignal) {
  return apiClient<FacturaDetalle>(`/facturacion/facturas/${facturaId}`, { signal })
}
