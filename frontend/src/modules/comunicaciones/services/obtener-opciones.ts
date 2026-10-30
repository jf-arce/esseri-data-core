import { apiClient } from '@/api/client'
import type { Opciones } from '../types'
export function obtenerOpciones(signal?: AbortSignal, docente = false, ciclo?: string) {
  const ruta = docente
    ? `/comunicaciones/docente/opciones?ciclo_lectivo=${ciclo ?? ''}`
    : '/comunicaciones/opciones'
  return apiClient<Opciones>(ruta, { signal })
}
