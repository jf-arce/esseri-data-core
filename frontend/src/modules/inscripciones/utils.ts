import { z } from 'zod'
import type {
  AlumnoReinscripcionOpcion,
  CrearInscripcionPayload,
  CrearReinscripcionPayload,
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
