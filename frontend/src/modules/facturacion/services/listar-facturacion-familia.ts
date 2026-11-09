import { apiClient } from '@/api/client'
import type {
  DetalleFacturaFamilia,
  FacturacionFamilia,
  PagoFamilia,
} from '@/modules/facturacion/types'

type FacturaCruda = Omit<
  FacturacionFamilia['facturas'][number],
  'fecha_vencimiento_efectiva' | 'detalles' | 'pagos'
> & {
  fecha_vencimiento_efectiva?: string | null
  detalles?: DetalleFacturaFamilia[]
  pagos?: PagoFamilia[]
}

/**
 * Completa los campos que un backend anterior a la excepción de vencimiento no enviaba.
 * Sin esto, el portal ordena por un valor ausente y la página entera se cae.
 */
export function normalizarFacturacionFamilia(cuenta: FacturacionFamilia): FacturacionFamilia {
  return {
    ...cuenta,
    facturas: (cuenta.facturas ?? []).map((factura) => {
      const cruda = factura as FacturaCruda
      return {
        ...factura,
        fecha_vencimiento_efectiva:
          cruda.fecha_vencimiento_efectiva || factura.fecha_vencimiento || '',
        detalles: cruda.detalles ?? [],
        pagos: cruda.pagos ?? [],
      }
    }),
    movimientos: cuenta.movimientos ?? [],
  }
}

export async function listarFacturacionFamilia(signal?: AbortSignal) {
  const cuenta = await apiClient<FacturacionFamilia>('/facturacion/familia/me', { signal })
  return normalizarFacturacionFamilia(cuenta)
}
