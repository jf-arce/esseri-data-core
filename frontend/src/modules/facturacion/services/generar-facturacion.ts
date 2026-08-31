import { apiClient } from '@/api/client'
import type { EjecucionFacturacion } from '@/modules/facturacion/types'

export function generarFacturacion(periodo: string) {
  return apiClient<EjecucionFacturacion>('/facturacion/reglas/generaciones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ periodo }),
  })
}
