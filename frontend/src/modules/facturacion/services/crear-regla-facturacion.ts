import { apiClient } from '@/api/client'
import type { ReglaFacturacion, ReglaFacturacionPayload } from '@/modules/facturacion/types'

export function crearReglaFacturacion(datos: ReglaFacturacionPayload) {
  return apiClient<ReglaFacturacion>('/facturacion/reglas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
