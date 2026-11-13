import { apiClient } from '@/api/client'
import type { ImportacionDebitosRead } from '@/modules/facturacion/types'

export function confirmarRespuestaDebitos(importacionId: string) {
  return apiClient<ImportacionDebitosRead>('/facturacion/cobranzas-simuladas/confirmar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ importacion_id: importacionId, revision_confirmada: true }),
  })
}
