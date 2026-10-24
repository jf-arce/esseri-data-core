import { descargarExport } from '@/lib/descargar-export'

export function descargarComprobantePagoFamilia(pagoId: string) {
  const id = encodeURIComponent(pagoId)
  return descargarExport(`/facturacion/familia/me/pagos/${id}/comprobante`, `comprobante-${id}`)
}
