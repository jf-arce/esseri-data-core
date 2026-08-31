import { apiClient } from '@/api/client'
import type { ReglaFacturacion, ReglaFacturacionPayload } from '@/modules/facturacion/types'

export function actualizarReglaFacturacion(id: string, datos: ReglaFacturacionPayload) {
  return apiClient<ReglaFacturacion>(`/facturacion/reglas/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
