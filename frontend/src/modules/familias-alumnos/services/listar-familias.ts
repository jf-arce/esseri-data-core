import { apiClient } from '@/api/client'
import type { Familia } from '../types'

export function listarFamilias() {
  return apiClient<Familia[]>('/familias-alumnos/familias')
}
