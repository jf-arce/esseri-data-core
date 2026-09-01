import { apiClient } from '@/api/client'
import type { MetodoPago } from '@/modules/facturacion/types'

export function listarMetodosPago(signal?: AbortSignal) {
  return apiClient<MetodoPago[]>('/facturacion/metodos-pago', { signal })
}
