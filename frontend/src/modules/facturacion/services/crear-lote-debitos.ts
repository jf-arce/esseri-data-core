import { apiClient } from '@/api/client'
import type { LoteDebitoDetalle, SeleccionDebitos } from '@/modules/facturacion/types'

export function crearLoteDebitos(seleccion: SeleccionDebitos, periodo?: string) {
  return apiClient<LoteDebitoDetalle>('/facturacion/cobranzas-simuladas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seleccion, periodo }),
  })
}
