import { apiClient } from '@/api/client'
import type { CrearRecepcionPayload, Recepcion } from '@/modules/proveedores-compras/types'

export function crearRecepcion(ordenId: string, datos: CrearRecepcionPayload) {
  return apiClient<Recepcion>(`/proveedores-compras/ordenes/${ordenId}/recepciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
