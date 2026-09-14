import { apiClient } from '@/api/client'
import type {
  AltaDocenteCreate,
  Docente,
  DocenteCreate,
  DocenteDesdeUsuarioCreate,
  DocenteUpdate,
} from '../types'

export function listarDocentes() {
  return apiClient<Docente[]>('/academico/docentes')
}

export function crearAltaDocente(datos: AltaDocenteCreate) {
  return apiClient<Docente>('/academico/docentes/alta-completa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

export function crearDocenteDesdeUsuario(datos: DocenteDesdeUsuarioCreate) {
  return apiClient<Docente>('/academico/docentes/desde-usuario', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

export function obtenerDocente(id: string) {
  return apiClient<Docente>(`/academico/docentes/${id}`)
}

export function crearDocente(datos: DocenteCreate) {
  return apiClient<Docente>('/academico/docentes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

export function actualizarDocente(id: string, datos: DocenteUpdate) {
  return apiClient<Docente>(`/academico/docentes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

export function eliminarDocente(id: string) {
  return apiClient<void>(`/academico/docentes/${id}`, {
    method: 'DELETE',
  })
}
