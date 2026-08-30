import { apiClient } from '@/api/client'
import type { Recepcion } from '@/modules/proveedores-compras/types'

export function listarRecepcionesDeOrden(ordenId: string) {
  return apiClient<Recepcion[]>(`/proveedores-compras/ordenes/${ordenId}/recepciones`)
}
