import { describe, expect, it } from 'vitest'
import {
  crearPayloadSolicitudAdmision,
  formularioAdmisionSchema,
  type FormularioAdmisionValues,
} from '@/modules/inscripciones/formulario-admision-utils'

const valoresBase: FormularioAdmisionValues = {
  cicloLectivo: '2027',
  fechaSolicitud: new Date(2026, 7, 30),
  nivelEducativoId: 'nivel-primario',
  aspirante: {
    nombre: 'Sofía',
    apellido: 'Pérez',
    dni: '12345678',
    telefono: '11 5555 5555',
    sexo: '',
  },
  contacto: {
    nombre: 'Marina',
    apellido: 'Pérez',
    dni: '23456789',
    telefono: '11 4444 4444',
    sexo: '',
  },
  contactoParentesco: 'Madre',
  contactoParentescoOtro: '',
  observaciones: 'Solicita entrevista por la mañana.',
}

describe('lógica del formulario de admisión', () => {
  it('exige un contacto responsable al iniciar una admisión', () => {
    expect(formularioAdmisionSchema.safeParse(valoresBase).success).toBe(true)
  })

  it('informa los campos obligatorios del contacto', () => {
    const resultado = formularioAdmisionSchema.safeParse({
      ...valoresBase,
      contacto: { ...valoresBase.contacto, nombre: '', apellido: '', dni: '' },
    })

    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(resultado.error.issues.map((issue) => issue.path.join('.'))).toEqual([
        'contacto.nombre',
        'contacto.apellido',
        'contacto.dni',
      ])
    }
  })

  it('requiere especificar el parentesco cuando se selecciona Otro', () => {
    const incompleto = formularioAdmisionSchema.safeParse({
      ...valoresBase,
      contactoParentesco: 'Otro',
      contactoParentescoOtro: '',
    })
    const completo = formularioAdmisionSchema.safeParse({
      ...valoresBase,
      contactoParentesco: 'Otro',
      contactoParentescoOtro: 'Representante legal',
    })

    expect(incompleto.success).toBe(false)
    expect(completo.success).toBe(true)
  })

  it('incluye el contacto responsable en el payload de la solicitud', () => {
    expect(crearPayloadSolicitudAdmision(valoresBase)).toEqual({
      ciclo_lectivo: '2027',
      fecha_solicitud: '2026-08-30',
      nivel_educativo_id: 'nivel-primario',
      aspirante: {
        nombre: 'Sofía',
        apellido: 'Pérez',
        dni: '12345678',
        telefono: '11 5555 5555',
      },
      contacto: {
        nombre: 'Marina',
        apellido: 'Pérez',
        dni: '23456789',
        telefono: '11 4444 4444',
      },
      contacto_parentesco: 'Madre',
      observaciones: 'Solicita entrevista por la mañana.',
    })
  })
})
