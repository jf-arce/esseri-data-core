import { apiClient } from '@/api/client'
import type { SolicitudCompra } from '@/modules/proveedores-compras/types'

export function listarSolicitudes() {
  return apiClient<SolicitudCompra[]>('/proveedores-compras/solicitudes')
}
