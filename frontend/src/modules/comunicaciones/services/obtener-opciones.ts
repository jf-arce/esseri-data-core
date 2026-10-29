import { apiClient } from '@/api/client'
import type { Opciones } from '../types'
export function obtenerOpciones(signal?: AbortSignal) {
  return apiClient<Opciones>('/comunicaciones/opciones', { signal })
}
