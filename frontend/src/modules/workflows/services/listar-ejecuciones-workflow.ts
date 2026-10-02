import { apiClient } from '@/api/client'
import { API_EJECUCIONES } from '@/modules/workflows/constants'
import type { EjecucionWorkflowListado, FiltrosEjecuciones } from '@/modules/workflows/types'

export function listarEjecucionesWorkflow(filtros: FiltrosEjecuciones, signal?: AbortSignal) {
  const parametros = new URLSearchParams({
    pagina: String(filtros.pagina),
    tamanio_pagina: String(filtros.tamanioPagina),
  })

  if (filtros.estado) parametros.set('estado', filtros.estado)

  return apiClient<EjecucionWorkflowListado>(`${API_EJECUCIONES}?${parametros.toString()}`, {
    signal,
  })
}
