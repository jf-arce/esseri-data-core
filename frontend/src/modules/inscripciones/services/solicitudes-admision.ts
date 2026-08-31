import { apiClient } from '@/api/client'
import type {
  ActualizarSolicitudAdmisionPayload,
  DocumentoSolicitudAdmision,
  FiltrosSolicitudesAdmision,
  SolicitudAdmision,
  SolicitudesAdmisionListado,
} from '@/modules/inscripciones/types'

export function listarSolicitudesAdmision(
  filtros: FiltrosSolicitudesAdmision,
  signal?: AbortSignal,
) {
  const parametros = new URLSearchParams({
    pagina: String(filtros.pagina),
    tamanio_pagina: String(filtros.tamanioPagina),
  })
  if (filtros.buscar?.trim()) parametros.set('buscar', filtros.buscar.trim())
  if (filtros.estado) parametros.set('estado', filtros.estado)
  if (filtros.etapa) parametros.set('etapa', filtros.etapa)

  return apiClient<SolicitudesAdmisionListado>(
    `/inscripciones/solicitudes?${parametros.toString()}`,
    { signal },
  )
}

export function obtenerSolicitudAdmision(id: string, signal?: AbortSignal) {
  return apiClient<SolicitudAdmision>(`/inscripciones/solicitudes/${id}`, { signal })
}

function actualizarSolicitud(
  id: string,
  accion: 'avanzar' | 'aprobar' | 'rechazar',
  observaciones?: string,
) {
  return apiClient<SolicitudAdmision>(`/inscripciones/solicitudes/${id}/${accion}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ observaciones: observaciones?.trim() || null }),
  })
}

export function editarSolicitudAdmision(id: string, datos: ActualizarSolicitudAdmisionPayload) {
  return apiClient<SolicitudAdmision>(`/inscripciones/solicitudes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}

export function avanzarSolicitudAdmision(id: string, observaciones?: string) {
  return actualizarSolicitud(id, 'avanzar', observaciones)
}

export function aprobarSolicitudAdmision(id: string, observaciones?: string) {
  return actualizarSolicitud(id, 'aprobar', observaciones)
}

export function confirmarInscripcionSolicitudAdmision(id: string) {
  return apiClient<SolicitudAdmision>(`/inscripciones/solicitudes/${id}/confirmar-inscripcion`, {
    method: 'POST',
  })
}

export function rechazarSolicitudAdmision(id: string, observaciones?: string) {
  return actualizarSolicitud(id, 'rechazar', observaciones)
}

function ejecutarAccionExcepcional(
  id: string,
  accion: 'revertir-etapa' | 'desistir' | 'revocar-aprobacion',
  motivo: string,
) {
  return apiClient<SolicitudAdmision>(`/inscripciones/solicitudes/${id}/${accion}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motivo: motivo.trim() }),
  })
}

export function revertirEtapaSolicitudAdmision(id: string, motivo: string) {
  return ejecutarAccionExcepcional(id, 'revertir-etapa', motivo)
}

export function desistirSolicitudAdmision(id: string, motivo: string) {
  return ejecutarAccionExcepcional(id, 'desistir', motivo)
}

export function revocarAprobacionSolicitudAdmision(id: string, motivo: string) {
  return ejecutarAccionExcepcional(id, 'revocar-aprobacion', motivo)
}

export function registrarDocumentoSolicitudAdmision(
  solicitudId: string,
  tipoDocumento: string,
  archivo: string,
) {
  return apiClient<DocumentoSolicitudAdmision>(
    `/inscripciones/solicitudes/${solicitudId}/documentos`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo_documento: tipoDocumento.trim(), archivo: archivo.trim() }),
    },
  )
}

export function actualizarDocumentoSolicitudAdmision(
  solicitudId: string,
  documentoId: string,
  estado: 'validado' | 'rechazado',
) {
  return apiClient<DocumentoSolicitudAdmision>(
    `/inscripciones/solicitudes/${solicitudId}/documentos/${documentoId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    },
  )
}
