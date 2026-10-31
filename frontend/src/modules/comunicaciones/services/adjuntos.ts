import { apiClient } from '@/api/client'
import type { Adjunto } from '../types'

function base(comunicacionId: string, docente: boolean) {
  return `${docente ? '/comunicaciones/docente' : '/comunicaciones'}/${comunicacionId}/adjuntos`
}

export function listarAdjuntos(comunicacionId: string, docente = false, signal?: AbortSignal) {
  return apiClient<Adjunto[]>(base(comunicacionId, docente), { signal })
}

export function subirAdjunto(comunicacionId: string, archivo: File, docente = false) {
  const cuerpo = new FormData()
  cuerpo.set('archivo', archivo)
  return apiClient<Adjunto>(base(comunicacionId, docente), { method: 'POST', body: cuerpo })
}

export function eliminarAdjunto(comunicacionId: string, adjuntoId: string, docente = false) {
  return apiClient<void>(`${base(comunicacionId, docente)}/${adjuntoId}`, { method: 'DELETE' })
}

export function analizarAdjunto(comunicacionId: string, adjuntoId: string, docente = false) {
  return apiClient<Adjunto>(`${base(comunicacionId, docente)}/${adjuntoId}/analizar`, {
    method: 'POST',
  })
}
