import { afterEach, describe, expect, it, vi } from 'vitest'
import { crearInscripcion } from '@/modules/inscripciones/services/crear-inscripcion'
import { crearReinscripcion } from '@/modules/inscripciones/services/crear-reinscripcion'
import { listarAlumnosReinscripcion } from '@/modules/inscripciones/services/listar-alumnos-reinscripcion'
import { listarInscripciones } from '@/modules/inscripciones/services/listar-inscripciones'
import { listarSolicitudesDisponibles } from '@/modules/inscripciones/services/listar-solicitudes-disponibles'
import { registrarBajaInscripcion } from '@/modules/inscripciones/services/registrar-baja-inscripcion'
import { registrarCambioMatricula } from '@/modules/inscripciones/services/registrar-cambio-matricula'

const respuestaOk = () =>
  new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

describe('servicios de inscripciones', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('codifica la búsqueda de solicitudes en la URL', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await listarSolicitudesDisponibles('Pérez 10')

    expect(fetchMock.mock.calls[0][0]).toContain(
      '/inscripciones/opciones/solicitudes?limite=50&buscar=P%C3%A9rez+10',
    )
  })

  it('envía el ciclo y la búsqueda al consultar alumnos para reinscripción', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await listarAlumnosReinscripcion('2027', 'Gómez')

    expect(fetchMock.mock.calls[0][0]).toContain(
      '/inscripciones/opciones/reinscripciones?ciclo_lectivo=2027&limite=50&buscar=G%C3%B3mez',
    )
  })

  it('usa endpoints distintos para inscripción nueva y reinscripción', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())
    const base = {
      ciclo_lectivo: '2027',
      fecha_inscripcion: '2026-08-28',
      alumno_id: 'alumno-1',
      division_id: 'division-1',
    }

    await crearInscripcion({ ...base, solicitud_inscripcion_id: 'solicitud-1' })
    await crearReinscripcion(base)

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/inscripciones$/)
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/inscripciones\/reinscripciones$/)
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toHaveProperty(
      'solicitud_inscripcion_id',
    )
    expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string)).not.toHaveProperty(
      'solicitud_inscripcion_id',
    )
  })

  it('envía los filtros y la paginación al listar inscripciones', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await listarInscripciones({
      buscar: 'Pérez 10',
      cicloLectivo: '2027',
      tipo: 'reinscripcion',
      estado: 'activa',
      pagina: 2,
      tamanioPagina: 10,
    })

    expect(fetchMock.mock.calls[0][0]).toContain(
      '/inscripciones?pagina=2&tamanio_pagina=10&buscar=P%C3%A9rez+10&ciclo_lectivo=2027&estado=activa&tipo=reinscripcion',
    )
  })

  it('usa los endpoints de cambio de matrícula y baja con sus fechas', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await registrarCambioMatricula('inscripcion-1', {
      division_id: 'division-2',
      fecha_cambio: '2027-03-10',
    })
    await registrarBajaInscripcion('inscripcion-1', { fecha_baja: '2027-05-15' })

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/inscripciones\/inscripcion-1\/cambios-matricula$/)
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      division_id: 'division-2',
      fecha_cambio: '2027-03-10',
    })
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/inscripciones\/inscripcion-1\/bajas$/)
    expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string)).toEqual({
      fecha_baja: '2027-05-15',
    })
  })
})
