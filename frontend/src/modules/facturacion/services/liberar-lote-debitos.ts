import { apiClient } from '@/api/client'
import type { LoteDebitoResumen } from '@/modules/facturacion/types'

export interface LiberarLoteDebitosPayload {
  motivo: string
  confirmacion_no_procesado: true
}

export function liberarLoteDebitos(loteId: string, datos: LiberarLoteDebitosPayload) {
  return apiClient<LoteDebitoResumen>(`/facturacion/cobranzas-simuladas/${loteId}/liberar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
