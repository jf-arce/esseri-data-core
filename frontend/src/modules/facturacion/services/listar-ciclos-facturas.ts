import { apiClient } from '@/api/client'

export function listarCiclosFacturas(
  filtros: { alumnoId?: string; familiaResponsableId?: string },
  signal?: AbortSignal,
) {
  const parametros = new URLSearchParams()
  if (filtros.alumnoId) parametros.set('alumno_id', filtros.alumnoId)
  if (filtros.familiaResponsableId)
    parametros.set('familia_responsable_id', filtros.familiaResponsableId)
  const consulta = parametros.toString()

  return apiClient<string[]>(`/facturacion/facturas/ciclos${consulta ? `?${consulta}` : ''}`, {
    signal,
  })
}
