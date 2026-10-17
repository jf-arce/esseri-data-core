import { apiClient } from '@/api/client'
import type { ResultadoDeteccion } from '@/modules/ia-sugerencias/types'

export function detectarPatrones() {
  return apiClient<ResultadoDeteccion>('/ia-sugerencias/patrones/detectar', { method: 'POST' })
}
