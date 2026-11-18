import { apiClient } from '@/api/client'
import { API_AUDITORIA, FILTRO_TODOS } from '@/modules/auditoria/constants'
import type { AuditoriaListado, FiltrosAuditoria } from '@/modules/auditoria/types'

export function listarAuditoria(filtros: FiltrosAuditoria, signal?: AbortSignal) {
  const parametros = new URLSearchParams({
    pagina: String(filtros.pagina),
    tamanio_pagina: String(filtros.tamanioPagina),
    orden: filtros.orden,
  })

  if (filtros.busqueda.trim()) parametros.set('buscar', filtros.busqueda.trim())
  if (filtros.entidad !== FILTRO_TODOS) parametros.set('entidad', filtros.entidad)
  if (filtros.campo !== FILTRO_TODOS) parametros.set('campo', filtros.campo)
  if (filtros.usuarioId !== FILTRO_TODOS) parametros.set('usuario_id', filtros.usuarioId)
  if (filtros.actorTipo !== FILTRO_TODOS) parametros.set('actor_tipo', filtros.actorTipo)
  if (filtros.origen !== FILTRO_TODOS) parametros.set('origen', filtros.origen)
  if (filtros.desde) parametros.set('desde', filtros.desde)
  if (filtros.hasta) parametros.set('hasta', filtros.hasta)

  return apiClient<AuditoriaListado>(`${API_AUDITORIA}?${parametros.toString()}`, { signal })
}
