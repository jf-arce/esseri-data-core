import { apiClient } from '@/api/client'
import type {
  EstadoJustificacion,
  JustificacionFamilia,
  JustificacionesPaginadas,
  OpcionJustificacion,
} from '../types'

export interface FiltrosJustificaciones {
  nivel_id?: string
  anio_id?: string
  division_id?: string
  alumno_id?: string
  estado?: EstadoJustificacion
  motivo?: string
  busqueda?: string
  fecha_desde?: string
  fecha_hasta?: string
  pagina?: number
  tamanio_pagina?: number
}

function parametros(filtros: FiltrosJustificaciones) {
  const params = new URLSearchParams()
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== '') params.set(clave, String(valor))
  }
  return params
}

export function listarJustificaciones(filtros: FiltrosJustificaciones = {}) {
  const qs = parametros(filtros).toString()
  return apiClient<JustificacionesPaginadas>(`/academico/justificaciones${qs ? `?${qs}` : ''}`)
}

export function obtenerOpcionesJustificaciones() {
  return apiClient<OpcionJustificacion[]>('/academico/justificaciones/opciones')
}

export function resolverJustificacion(id: string, aprobar: boolean, observacion?: string) {
  return apiClient<JustificacionFamilia>(`/academico/justificaciones/${id}/resolver`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aprobar, ...(observacion ? { observacion } : {}) }),
  })
}

export type AltaJustificacionAdministrativa = {
  alumnoId: string
  fecha: string
  motivo: string
  observacion?: string
  comprobante?: File
}

/** Alta desde Administración: el backend la crea ya aprobada. */
export function crearJustificacionAdministrativa(
  datos: AltaJustificacionAdministrativa,
): Promise<JustificacionFamilia> {
  const formulario = new FormData()
  formulario.append('alumno_id', datos.alumnoId)
  formulario.append('fecha', datos.fecha)
  formulario.append('motivo', datos.motivo)
  if (datos.observacion) formulario.append('observacion', datos.observacion)
  if (datos.comprobante) formulario.append('comprobante', datos.comprobante)

  return apiClient<JustificacionFamilia>('/academico/justificaciones', {
    method: 'POST',
    body: formulario,
  })
}
