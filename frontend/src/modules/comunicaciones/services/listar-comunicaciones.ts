import { apiClient } from '@/api/client'
import type { Listado } from '../types'
export function listarComunicaciones(
  familia: boolean,
  pagina: number,
  buscar: string,
  noLeidas: boolean,
  signal: AbortSignal,
) {
  const query = new URLSearchParams({
    pagina: String(pagina),
    buscar,
    ...(familia ? { no_leidas: String(noLeidas) } : {}),
  })
  return apiClient<Listado>(`/comunicaciones${familia ? '/familia' : ''}?${query}`, { signal })
}
