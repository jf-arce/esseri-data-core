import { apiClient } from '@/api/client'

export interface MesFinanciero {
  mes: string
  facturado: string
  cobrado: string
}

export function obtenerEvolucionFinanciera() {
  return apiClient<MesFinanciero[]>('/panel-admin/evolucion-financiera')
}
