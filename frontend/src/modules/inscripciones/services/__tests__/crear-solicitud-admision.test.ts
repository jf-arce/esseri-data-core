import { afterEach, describe, expect, it, vi } from 'vitest'
import { crearSolicitudAdmision } from '@/modules/inscripciones/services/crear-solicitud-admision'

describe('crearSolicitudAdmision', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('envía la solicitud inicial al endpoint de admisiones', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await crearSolicitudAdmision({
      ciclo_lectivo: '2027',
      fecha_solicitud: '2026-08-30',
      nivel_educativo_id: 'nivel-1',
      aspirante: { nombre: 'Sofía', apellido: 'Pérez', dni: '12345678' },
    })

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/inscripciones\/solicitudes$/)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' })
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toMatchObject({
      ciclo_lectivo: '2027',
      aspirante: { nombre: 'Sofía', apellido: 'Pérez', dni: '12345678' },
    })
  })
})
