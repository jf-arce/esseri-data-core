import { apiClient } from '@/api/client'
import type { FacturacionFamilia } from '@/modules/facturacion/types'

export function listarFacturacionFamilia(signal?: AbortSignal) {
  return apiClient<FacturacionFamilia>('/facturacion/familia/me', { signal })
}
