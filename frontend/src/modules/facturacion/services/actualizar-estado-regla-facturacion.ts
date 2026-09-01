import { apiClient } from '@/api/client'
import type { EstadoReglaFacturacion, ReglaFacturacion } from '@/modules/facturacion/types'

export function actualizarEstadoReglaFacturacion(id: string, estado: EstadoReglaFacturacion) {
  return apiClient<ReglaFacturacion>(`/facturacion/reglas/${id}/estado`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado }),
  })
}
