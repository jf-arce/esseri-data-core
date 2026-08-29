import { apiClient } from '@/api/client'
import type { LineaPendiente } from '@/modules/proveedores-compras/types'

export function listarPendientesDeOrden(ordenId: string) {
  return apiClient<LineaPendiente[]>(`/proveedores-compras/ordenes/${ordenId}/pendientes`)
}
