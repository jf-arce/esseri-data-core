import { apiClient } from '@/api/client'
import type { Sugerencia } from '@/modules/ia-sugerencias/types'

export function listarSugerencias() {
  return apiClient<Sugerencia[]>('/ia-sugerencias/sugerencias')
}
