import { apiClient } from '@/api/client'
import type { FiltrosImportacionDebitos, ImportacionDebitosRead } from '@/modules/facturacion/types'

export function obtenerImportacionDebitos(
  importacionId: string,
  filtros: FiltrosImportacionDebitos,
  signal?: AbortSignal,
) {
  const parametros = new URLSearchParams()
  parametros.set('resultado', filtros.resultado)
  if (filtros.buscar) parametros.set('buscar', filtros.buscar)
  parametros.set('pagina', String(filtros.pagina))
  parametros.set('tamanio', String(filtros.tamanio))
  return apiClient<ImportacionDebitosRead>(
    `/facturacion/cobranzas-simuladas/importaciones/${importacionId}?${parametros.toString()}`,
    { signal },
  )
}
