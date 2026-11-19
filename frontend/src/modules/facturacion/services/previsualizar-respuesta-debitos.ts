import { apiClient } from '@/api/client'
import type { ImportacionDebitosRead } from '@/modules/facturacion/types'

export function previsualizarRespuestaDebitos(contenido: string) {
  return apiClient<ImportacionDebitosRead>('/facturacion/cobranzas-simuladas/previsualizar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contenido }),
  })
}
