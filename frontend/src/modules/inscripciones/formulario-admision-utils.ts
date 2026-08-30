import { z } from 'zod'
import type { CrearSolicitudAdmisionPayload } from '@/modules/inscripciones/types'
import { fechaParaApi } from '@/modules/inscripciones/utils'

const requerido = 'Este campo es obligatorio.'

const personaSchema = z.object({
  nombre: z.string().trim().min(1, requerido),
  apellido: z.string().trim().min(1, requerido),
  dni: z.string().trim().min(6, 'Ingresá un DNI válido.'),
  telefono: z.string().trim(),
  sexo: z.string().trim(),
})

const contactoSchema = z.object({
  nombre: z.string().trim(),
  apellido: z.string().trim(),
  dni: z.string().trim(),
  telefono: z.string().trim(),
  sexo: z.string().trim(),
})

export const formularioAdmisionSchema = z
  .object({
    cicloLectivo: z.string().regex(/^[1-9]\d{3}$/, 'Ingresá un ciclo lectivo válido.'),
    fechaSolicitud: z.date({ error: requerido }),
    nivelEducativoId: z.string().min(1, requerido),
    aspirante: personaSchema,
    contacto: contactoSchema,
    observaciones: z.string().trim().max(2000, 'Máximo 2000 caracteres.'),
  })
  .superRefine((datos, contexto) => {
    const valoresContacto = Object.values(datos.contacto)
    const tieneContacto = valoresContacto.some((valor) => valor.length > 0)
    if (!tieneContacto) return

    for (const campo of ['nombre', 'apellido', 'dni'] as const) {
      if (!datos.contacto[campo]) {
        contexto.addIssue({
          code: 'custom',
          path: ['contacto', campo],
          message: requerido,
        })
      }
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
  const contacto = personaPayload(valores.contacto)
  const tieneContacto = Object.values(contacto).some((valor) => valor.length > 0)

  return {
    ciclo_lectivo: valores.cicloLectivo,
    fecha_solicitud: fechaParaApi(valores.fechaSolicitud),
    nivel_educativo_id: valores.nivelEducativoId,
    aspirante: personaPayload(valores.aspirante),
    ...(tieneContacto ? { contacto } : {}),
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
    observaciones: '',
  }
}
