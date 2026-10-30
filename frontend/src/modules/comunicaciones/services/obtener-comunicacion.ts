import { apiClient } from '@/api/client'
import type { Comunicacion } from '../types'
export function obtenerComunicacion(
  id: string,
  familia: boolean,
  signal?: AbortSignal,
  docente = false,
) {
  const prefijo = docente
    ? '/comunicaciones/docente'
    : familia
      ? '/comunicaciones/familia'
      : '/comunicaciones'
  return apiClient<Comunicacion>(`${prefijo}/${id}`, { signal })
}
