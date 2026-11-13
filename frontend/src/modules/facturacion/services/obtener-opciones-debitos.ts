import { apiClient } from '@/api/client'
import type { OpcionesDebitos } from '@/modules/facturacion/types'

export function obtenerOpcionesDebitos(signal?: AbortSignal) {
  return apiClient<OpcionesDebitos>('/facturacion/cobranzas-simuladas/opciones', { signal })
}
