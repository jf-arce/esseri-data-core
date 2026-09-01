import { apiClient } from '@/api/client'
import type { PagoFactura, RegistrarPagoPayload } from '@/modules/facturacion/types'

export function registrarPago(facturaId: string, datos: RegistrarPagoPayload) {
  const cuerpo = new FormData()
  cuerpo.set('fecha', datos.fecha)
  cuerpo.set('monto', datos.monto)
  cuerpo.set('metodo_pago_id', datos.metodo_pago_id)
  if (datos.referencia_transaccion)
    cuerpo.set('referencia_transaccion', datos.referencia_transaccion)
  if (datos.comprobante) cuerpo.set('comprobante', datos.comprobante)

  return apiClient<PagoFactura>(`/facturacion/facturas/${facturaId}/pagos`, {
    method: 'POST',
    body: cuerpo,
  })
}
