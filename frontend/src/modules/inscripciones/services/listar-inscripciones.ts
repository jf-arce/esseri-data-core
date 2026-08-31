import { apiClient } from '@/api/client'
import type { FiltrosInscripciones, InscripcionListado } from '@/modules/inscripciones/types'

export function listarInscripciones(filtros: FiltrosInscripciones, signal?: AbortSignal) {
  const parametros = new URLSearchParams({
    pagina: String(filtros.pagina),
    tamanio_pagina: String(filtros.tamanioPagina),
  })

  if (filtros.buscar?.trim()) parametros.set('buscar', filtros.buscar.trim())
  if (filtros.cicloLectivo) parametros.set('ciclo_lectivo', filtros.cicloLectivo)
  if (filtros.estado) parametros.set('estado', filtros.estado)
  if (filtros.tipo) parametros.set('tipo', filtros.tipo)
  if (filtros.ordenarPor) parametros.set('ordenar_por', filtros.ordenarPor)
  if (filtros.direccion) parametros.set('direccion', filtros.direccion)

  return apiClient<InscripcionListado>(`/inscripciones?${parametros.toString()}`, { signal })
}
