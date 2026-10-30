import { apiClient } from '@/api/client'
import type { Envio } from '../types'

export function listarEnvios(id: string, docente = false, signal?: AbortSignal) {
  const base = docente ? '/comunicaciones/docente' : '/comunicaciones'
  return apiClient<Envio[]>(`${base}/${id}/envios`, { signal })
}

export function reintentarEnvio(id: string, envioId: string, docente = false) {
  const base = docente ? '/comunicaciones/docente' : '/comunicaciones'
  return apiClient<Envio>(`${base}/${id}/envios/${envioId}/reintentar`, { method: 'POST' })
}
