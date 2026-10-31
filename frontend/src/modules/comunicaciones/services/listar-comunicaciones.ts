import { apiClient } from '@/api/client'
import type { Listado } from '../types'
export function listarComunicaciones(
  familia: boolean,
  pagina: number,
  buscar: string,
  noLeidas: boolean,
  signal: AbortSignal,
  docente = false,
  estado?: 'publicada' | 'borrador',
) {
  const prefijo = docente
    ? '/comunicaciones/docente'
    : familia
      ? '/comunicaciones/familia'
      : '/comunicaciones'
  const query = new URLSearchParams({
    pagina: String(pagina),
    buscar,
    ...(familia ? { no_leidas: String(noLeidas) } : {}),
    ...(!familia && estado ? { estado } : {}),
  })
  return apiClient<Listado>(`${prefijo}?${query}`, { signal })
}
