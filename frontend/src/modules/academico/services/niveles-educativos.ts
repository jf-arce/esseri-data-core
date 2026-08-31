import { apiClient } from '@/api/client'
import type { NivelEducativo, NivelEducativoCreate, NivelEducativoUpdate } from '../types'

export function listarNiveles() {
  return apiClient<NivelEducativo[]>('/academico/niveles')
}

export function obtenerNivel(id: string) {
  return apiClient<NivelEducativo>(`/academico/niveles/${id}`)
}

export function crearNivel(datos: NivelEducativoCreate) {
  return apiClient<NivelEducativo>('/academico/niveles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

export function actualizarNivel(id: string, datos: NivelEducativoUpdate) {
  return apiClient<NivelEducativo>(`/academico/niveles/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

export function eliminarNivel(id: string) {
  return apiClient<void>(`/academico/niveles/${id}`, {
    method: 'DELETE',
  })
}
