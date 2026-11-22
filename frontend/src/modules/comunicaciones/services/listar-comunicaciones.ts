import { apiClient } from '@/api/client'
import type { Listado } from '../types'

export type FiltrosListadoGestion = {
  tipo: string
  destinatarios: string
  nivel_id: string
  division_id: string
  fecha_desde: string
  fecha_hasta: string
  retirada: string
}

export function listarComunicaciones(
  familia: boolean,
  pagina: number,
  buscar: string,
  noLeidas: boolean,
  signal: AbortSignal,
  docente = false,
  estado?: 'publicada' | 'borrador',
  tamanio?: number,
  orden: 'recientes' | 'antiguas' = 'recientes',
  filtros?: FiltrosListadoGestion,
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
    ...(familia && tamanio ? { tamanio: String(tamanio) } : {}),
    ...(familia ? { orden } : {}),
    ...(!familia && estado ? { estado } : {}),
  })
  if (!familia && !docente && filtros) {
    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor) query.set(clave, valor)
    }
  }
  return apiClient<Listado>(`${prefijo}?${query}`, { signal })
}
