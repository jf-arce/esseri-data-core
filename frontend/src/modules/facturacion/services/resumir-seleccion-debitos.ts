import { apiClient } from '@/api/client'
import type { ResumenSeleccionDebitos, SeleccionDebitos } from '@/modules/facturacion/types'

export function resumirSeleccionDebitos(seleccion: SeleccionDebitos, signal?: AbortSignal) {
  return apiClient<ResumenSeleccionDebitos>('/facturacion/cobranzas-simuladas/resumen-seleccion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seleccion }),
    signal,
  })
}
