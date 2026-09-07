import { z } from 'zod'
import type { CrearSolicitudAdmisionPayload } from '@/modules/inscripciones/types'
import { fechaParaApi } from '@/modules/inscripciones/utils'

const requerido = 'Este campo es obligatorio.'
export const OPCIONES_PARENTESCO = [
  'Madre',
  'Padre',
  'Tutor/a',
  'Abuelo/a',
  'Hermano/a',
  'Otro',
] as const

const personaSchema = z.object({
  nombre: z.string().trim().min(1, requerido),
  apellido: z.string().trim().min(1, requerido),
  dni: z.string().trim().min(6, 'Ingresá un DNI válido.'),
  telefono: z.string().trim(),
  sexo: z.string().trim(),
})

export const formularioAdmisionSchema = z
  .object({
    cicloLectivo: z.string().regex(/^[1-9]\d{3}$/, 'Ingresá un ciclo lectivo válido.'),
    fechaSolicitud: z.date({ error: requerido }),
    nivelEducativoId: z.string().min(1, requerido),
    aspirante: personaSchema,
    contacto: personaSchema,
    contactoParentesco: z.enum(OPCIONES_PARENTESCO, { error: requerido }),
    contactoParentescoOtro: z.string().trim(),
    observaciones: z.string().trim().max(2000, 'Máximo 2000 caracteres.'),
  })
  .superRefine((datos, contexto) => {
    if (datos.contactoParentesco === 'Otro' && !datos.contactoParentescoOtro) {
      contexto.addIssue({
        code: 'custom',
        path: ['contactoParentescoOtro'],
        message: 'Especificá el parentesco.',
      })
    }
  })

export type FormularioAdmisionValues = z.infer<typeof formularioAdmisionSchema>

function personaPayload(persona: FormularioAdmisionValues['aspirante']) {
  return {
    nombre: persona.nombre.trim(),
    apellido: persona.apellido.trim(),
    dni: persona.dni.trim(),
    ...(persona.telefono.trim() ? { telefono: persona.telefono.trim() } : {}),
    ...(persona.sexo.trim() ? { sexo: persona.sexo.trim() } : {}),
  }
}

export function crearPayloadSolicitudAdmision(
  valores: FormularioAdmisionValues,
): CrearSolicitudAdmisionPayload {
  return {
    ciclo_lectivo: valores.cicloLectivo,
    fecha_solicitud: fechaParaApi(valores.fechaSolicitud),
    nivel_educativo_id: valores.nivelEducativoId,
    aspirante: personaPayload(valores.aspirante),
    contacto: personaPayload(valores.contacto),
    contacto_parentesco: valores.contactoParentesco,
    ...(valores.contactoParentesco === 'Otro'
      ? { contacto_parentesco_otro: valores.contactoParentescoOtro.trim() }
      : {}),
    ...(valores.observaciones ? { observaciones: valores.observaciones } : {}),
  }
}

export function valoresInicialesAdmision(fecha = new Date()): FormularioAdmisionValues {
  return {
    cicloLectivo: String(fecha.getFullYear() + 1),
    fechaSolicitud: fecha,
    nivelEducativoId: '',
    aspirante: { nombre: '', apellido: '', dni: '', telefono: '', sexo: '' },
    contacto: { nombre: '', apellido: '', dni: '', telefono: '', sexo: '' },
    contactoParentesco: 'Madre',
    contactoParentescoOtro: '',
    observaciones: '',
  }
}
