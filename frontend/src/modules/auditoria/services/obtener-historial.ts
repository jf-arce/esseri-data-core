import { apiClient } from '@/api/client'
import type { HistorialEntrada } from '../types'

export function obtenerHistorial(entidad: string, entidadId: string) {
  return apiClient<HistorialEntrada[]>(
    `/auditoria/${encodeURIComponent(entidad)}/${encodeURIComponent(entidadId)}`,
  )
}
