import { z } from 'zod'
import type {
  AlumnoReinscripcionOpcion,
  CrearInscripcionPayload,
  CrearReinscripcionPayload,
  InscripcionRead,
  EstadoSolicitudAdmision,
  EstadoEtapaSolicitudAdmision,
  EtapaSolicitudAdmision,
  SolicitudInscripcionOpcion,
  TipoInscripcionFormulario,
} from '@/modules/inscripciones/types'

const mensajeRequerido = 'Este campo es obligatorio.'

export const formularioInscripcionSchema = z
  .object({
    tipo: z.enum(['nueva', 'reinscripcion']),
    fechaInscripcion: z.date({ error: mensajeRequerido }),
    cicloLectivo: z.string(),
    solicitudId: z.string(),
    alumnoId: z.string(),
    divisionId: z.string().min(1, mensajeRequerido),
  })
  .superRefine((datos, contexto) => {
    if (datos.tipo === 'nueva' && !datos.solicitudId) {
      contexto.addIssue({
        code: 'custom',
        path: ['solicitudId'],
        message: 'Seleccioná una solicitud confirmada.',
      })
    }

    if (datos.tipo === 'reinscripcion') {
      if (!/^[1-9]\d{3}$/.test(datos.cicloLectivo)) {
        contexto.addIssue({
          code: 'custom',
          path: ['cicloLectivo'],
          message: 'Ingresá un ciclo lectivo válido de cuatro dígitos.',
        })
      }
      if (!datos.alumnoId) {
        contexto.addIssue({
          code: 'custom',
          path: ['alumnoId'],
          message: 'Seleccioná un alumno habilitado para reinscribirse.',
        })
      }
    }
  })

export type FormularioInscripcionValues = z.infer<typeof formularioInscripcionSchema>

export function fechaParaApi(fecha: Date) {
  const year = fecha.getFullYear()
  const month = String(fecha.getMonth() + 1).padStart(2, '0')
  const day = String(fecha.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function cicloLectivoSugerido(fecha = new Date()) {
  return String(fecha.getFullYear() + 1)
}

export function crearPayloadInscripcion(
  valores: FormularioInscripcionValues,
  solicitud: SolicitudInscripcionOpcion,
): CrearInscripcionPayload {
  return {
    ciclo_lectivo: solicitud.ciclo_lectivo,
    fecha_inscripcion: fechaParaApi(valores.fechaInscripcion),
    alumno_id: solicitud.alumno_id,
    division_id: valores.divisionId,
    solicitud_inscripcion_id: solicitud.id,
  }
}

export function crearPayloadReinscripcion(
  valores: FormularioInscripcionValues,
  alumno: AlumnoReinscripcionOpcion,
): CrearReinscripcionPayload {
  return {
    ciclo_lectivo: valores.cicloLectivo,
    fecha_inscripcion: fechaParaApi(valores.fechaInscripcion),
    alumno_id: alumno.alumno_id,
    division_id: valores.divisionId,
  }
}

export function valoresIniciales(tipo: TipoInscripcionFormulario = 'nueva') {
  return {
    tipo,
    fechaInscripcion: new Date(),
    cicloLectivo: cicloLectivoSugerido(),
    solicitudId: '',
    alumnoId: '',
    divisionId: '',
  } satisfies FormularioInscripcionValues
}

export function formatearFechaInscripcion(fecha: string) {
  const [anio, mes, dia] = fecha.split('-')
  return `${dia}/${mes}/${anio}`
}

export function etiquetaTipoInscripcion(tipo: InscripcionRead['tipo']) {
  const etiquetas: Record<InscripcionRead['tipo'], string> = {
    nueva: 'Nueva',
    reinscripcion: 'Reinscripción',
    cambio_matricula: 'Cambio de matrícula',
    baja: 'Baja',
  }
  return etiquetas[tipo]
}

export function etiquetaEstadoInscripcion(estado: InscripcionRead['estado']) {
  const etiquetas: Record<InscripcionRead['estado'], string> = {
    activa: 'Activa',
    finalizada: 'Finalizada',
    baja: 'Baja',
  }
  return etiquetas[estado]
}

export function etiquetaEtapaSolicitud(etapa: EtapaSolicitudAdmision) {
  const etiquetas: Record<EtapaSolicitudAdmision, string> = {
    consulta_lead: 'Consulta / lead',
    entrevista: 'Entrevista',
    postulacion: 'Postulación',
    evaluacion_aprobacion: 'Evaluación',
    reserva_matricula: 'Reserva de vacante',
    documentacion_contrato: 'Documentación y contrato',
    inscripcion_confirmada: 'Inscripción confirmada',
  }
  return etiquetas[etapa]
}

export function etiquetaEstadoSolicitud(estado: EstadoSolicitudAdmision) {
  const etiquetas: Record<EstadoSolicitudAdmision, string> = {
    en_proceso: 'En proceso',
    aprobada: 'Aprobada',
    rechazada: 'Rechazada',
    desistida: 'Desistida',
  }
  return etiquetas[estado]
}

export function etiquetaEstadoEtapaSolicitud(estado: EstadoEtapaSolicitudAdmision) {
  const etiquetas: Record<EstadoEtapaSolicitudAdmision, string> = {
    en_proceso: 'En proceso',
    completada: 'Completada',
    rechazada: 'Rechazada',
    revertida: 'Revertida',
    desistida: 'Desistida',
  }
  return etiquetas[estado]
}

export type PaginaVisible = number | 'elipsis'

export function paginasVisibles(totalPaginas: number, paginaActual: number): PaginaVisible[] {
  if (totalPaginas <= 5) {
    return Array.from({ length: totalPaginas }, (_, indice) => indice + 1)
  }

  if (paginaActual <= 3) return [1, 2, 3, 4, 'elipsis', totalPaginas]
  if (paginaActual >= totalPaginas - 2) {
    return [1, 'elipsis', totalPaginas - 3, totalPaginas - 2, totalPaginas - 1, totalPaginas]
  }
  return [1, 'elipsis', paginaActual - 1, paginaActual, paginaActual + 1, 'elipsis', totalPaginas]
}
