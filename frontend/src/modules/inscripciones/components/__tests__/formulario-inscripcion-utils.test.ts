import { describe, expect, it } from 'vitest'
import {
  crearPayloadInscripcion,
  crearPayloadReinscripcion,
  etiquetaEstadoInscripcion,
  etiquetaTipoInscripcion,
  formatearFechaInscripcion,
  formularioInscripcionSchema,
  type FormularioInscripcionValues,
} from '@/modules/inscripciones/utils'
import type {
  AlumnoReinscripcionOpcion,
  SolicitudInscripcionOpcion,
} from '@/modules/inscripciones/types'

const valoresBase: FormularioInscripcionValues = {
  tipo: 'nueva',
  fechaInscripcion: new Date(2026, 7, 28),
  cicloLectivo: '',
  solicitudId: 'solicitud-1',
  alumnoId: 'alumno-1',
  divisionId: 'division-1',
}

const solicitud: SolicitudInscripcionOpcion = {
  id: 'solicitud-1',
  ciclo_lectivo: '2027',
  fecha_solicitud: '2026-08-20',
  alumno_id: 'alumno-1',
  alumno_nombre: 'Martina',
  alumno_apellido: 'Ibáñez',
  numero_legajo: 'A-100',
  nivel_educativo_id: 'nivel-1',
  nivel_educativo_nombre: 'Primario',
}

const alumno: AlumnoReinscripcionOpcion = {
  alumno_id: 'alumno-2',
  alumno_nombre: 'Juan',
  alumno_apellido: 'Pérez',
  numero_legajo: 'A-200',
  ciclo_anterior: '2026',
}

describe('lógica del formulario de inscripción', () => {
  it('exige solicitud para una inscripción nueva', () => {
    const resultado = formularioInscripcionSchema.safeParse({
      ...valoresBase,
      solicitudId: '',
    })

    expect(resultado.success).toBe(false)
  })

  it('exige ciclo de cuatro dígitos y alumno para una reinscripción', () => {
    const resultado = formularioInscripcionSchema.safeParse({
      ...valoresBase,
      tipo: 'reinscripcion',
      cicloLectivo: '27',
      solicitudId: '',
      alumnoId: '',
    })

    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(resultado.error.issues.map((issue) => issue.path[0])).toEqual([
        'cicloLectivo',
        'alumnoId',
      ])
    }
  })

  it('arma la inscripción nueva con el alumno y ciclo de la solicitud aprobada', () => {
    expect(crearPayloadInscripcion(valoresBase, solicitud)).toEqual({
      ciclo_lectivo: '2027',
      fecha_inscripcion: '2026-08-28',
      alumno_id: 'alumno-1',
      division_id: 'division-1',
      solicitud_inscripcion_id: 'solicitud-1',
    })
  })

  it('arma la reinscripción sin incluir una solicitud', () => {
    expect(
      crearPayloadReinscripcion(
        { ...valoresBase, tipo: 'reinscripcion', cicloLectivo: '2027', alumnoId: 'alumno-2' },
        alumno,
      ),
    ).toEqual({
      ciclo_lectivo: '2027',
      fecha_inscripcion: '2026-08-28',
      alumno_id: 'alumno-2',
      division_id: 'division-1',
    })
  })
})

describe('utilidades del listado de inscripciones', () => {
  it('formatea los valores que muestra la tabla', () => {
    expect(formatearFechaInscripcion('2026-08-28')).toBe('28/08/2026')
    expect(etiquetaTipoInscripcion('cambio_matricula')).toBe('Cambio de matrícula')
    expect(etiquetaEstadoInscripcion('finalizada')).toBe('Finalizada')
  })
})
