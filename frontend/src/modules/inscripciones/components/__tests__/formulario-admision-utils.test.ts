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
  contacto: { nombre: '', apellido: '', dni: '', telefono: '', sexo: '' },
  observaciones: 'Solicita entrevista por la mañana.',
}

describe('lógica del formulario de admisión', () => {
  it('permite no informar contacto responsable al iniciar una admisión', () => {
    expect(formularioAdmisionSchema.safeParse(valoresBase).success).toBe(true)
  })

  it('exige los datos mínimos si se empieza a cargar un contacto', () => {
    const resultado = formularioAdmisionSchema.safeParse({
      ...valoresBase,
      contacto: { ...valoresBase.contacto, telefono: '11 4444 4444' },
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

  it('arma el payload sin contacto vacío y conserva los datos de la solicitud', () => {
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
      observaciones: 'Solicita entrevista por la mañana.',
    })
  })
})
