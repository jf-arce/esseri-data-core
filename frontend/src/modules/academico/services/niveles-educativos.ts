import { apiClient } from '@/api/client'
import type { NivelEducativo } from '../types'

export function listarNiveles() {
  return apiClient<NivelEducativo[]>('/academico/niveles')
}

export function obtenerNivel(id: string) {
  return apiClient<NivelEducativo>(`/academico/niveles/${id}`)
}
