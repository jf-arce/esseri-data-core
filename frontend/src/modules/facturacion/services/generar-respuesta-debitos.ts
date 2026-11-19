import { apiClient } from '@/api/client'
import type { ArchivoDebitos } from '@/modules/facturacion/types'

export function generarRespuestaDebitos(
  loteId: string,
  opciones: { rechazarReferencias?: string[]; rechazosCantidad?: number } = {},
) {
  return apiClient<ArchivoDebitos>(`/facturacion/cobranzas-simuladas/${loteId}/respuesta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rechazar_referencias: opciones.rechazarReferencias ?? [],
      rechazos_cantidad: opciones.rechazosCantidad,
    }),
  })
}
