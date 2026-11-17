import { apiClient } from '@/api/client'
import type { AreaSolicitante } from '@/modules/proveedores-compras/types'

export function listarAreasSolicitantes() {
  return apiClient<AreaSolicitante[]>('/proveedores-compras/areas-solicitantes')
}
