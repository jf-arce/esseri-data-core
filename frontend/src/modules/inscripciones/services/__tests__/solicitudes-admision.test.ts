import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  desistirSolicitudAdmision,
  editarSolicitudAdmision,
  revertirEtapaSolicitudAdmision,
  revocarAprobacionSolicitudAdmision,
} from '@/modules/inscripciones/services/solicitudes-admision'

const respuestaOk = () =>
  new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

describe('servicios de acciones de admisión', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('edita únicamente los datos administrativos mediante PUT', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await editarSolicitudAdmision('solicitud-1', {
      ciclo_lectivo: '2027',
      fecha_solicitud: '2026-08-30',
      nivel_educativo_id: 'nivel-1',
      observaciones: 'Dato corregido.',
    })

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/inscripciones\/solicitudes\/solicitud-1$/)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'PUT' })
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).not.toHaveProperty('etapa')
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).not.toHaveProperty('estado')
  })

  it('envía cada acción excepcional con un motivo obligatorio', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await revertirEtapaSolicitudAdmision('solicitud-1', 'Se avanzó por error.')
    await desistirSolicitudAdmision('solicitud-1', 'La familia no continuará.')
    await revocarAprobacionSolicitudAdmision('solicitud-1', 'Faltaba revisar documentación.')

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      expect.stringMatching(/\/revertir-etapa$/),
      expect.stringMatching(/\/desistir$/),
      expect.stringMatching(/\/revocar-aprobacion$/),
    ])
    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(init?.body as string))).toEqual([
      { motivo: 'Se avanzó por error.' },
      { motivo: 'La familia no continuará.' },
      { motivo: 'Faltaba revisar documentación.' },
    ])
  })
})
