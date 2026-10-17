import { apiClient } from '@/api/client'
import { API_TAREAS } from '@/modules/workflows/constants'
import type { FiltrosTareas, TareaListado } from '@/modules/workflows/types'

export function listarTareas(filtros: FiltrosTareas, signal?: AbortSignal) {
  const parametros = new URLSearchParams({
    pagina: String(filtros.pagina),
    tamanio_pagina: String(filtros.tamanioPagina),
  })

  if (filtros.estado) parametros.set('estado', filtros.estado)
  if (filtros.prioridad) parametros.set('prioridad', filtros.prioridad)
  if (filtros.soloMias) parametros.set('solo_mias', 'true')

  return apiClient<TareaListado>(`${API_TAREAS}?${parametros.toString()}`, { signal })
}
