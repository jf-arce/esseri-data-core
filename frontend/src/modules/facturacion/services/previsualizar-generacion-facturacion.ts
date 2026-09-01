import { apiClient } from '@/api/client'
import type { ResumenGeneracionFacturacion } from '@/modules/facturacion/types'

export function previsualizarGeneracionFacturacion(periodo: string) {
  return apiClient<ResumenGeneracionFacturacion>('/facturacion/reglas/generaciones/previsualizar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ periodo }),
  })
}
