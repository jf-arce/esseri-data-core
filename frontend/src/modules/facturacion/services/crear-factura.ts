import { apiClient } from '@/api/client'
import type { CrearFacturaPayload, Factura } from '@/modules/facturacion/types'

export function crearFactura(payload: CrearFacturaPayload) {
  return apiClient<Factura>('/facturacion/facturas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
