import { apiClient } from '@/api/client'
import type { ReglaFacturacion } from '@/modules/facturacion/types'

export function listarReglasFacturacion(signal?: AbortSignal) {
  return apiClient<ReglaFacturacion[]>('/facturacion/reglas', { signal })
}
