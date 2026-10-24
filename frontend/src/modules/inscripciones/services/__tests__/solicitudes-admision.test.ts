import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  desistirSolicitudAdmision,
  editarSolicitudAdmision,
  revertirEtapaSolicitudAdmision,
  revocarAprobacionSolicitudAdmision,
  registrarDocumentoSolicitudAdmision,
  urlArchivoDocumentoSolicitudAdmision,
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

  it('envía el documento de admisión como multipart con el archivo seleccionado', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())
    const archivo = new File(['%PDF-1.7'], 'dni-sofia.pdf', { type: 'application/pdf' })

    await registrarDocumentoSolicitudAdmision('solicitud-1', 'DNI del aspirante', archivo)

    const [url, init] = fetchMock.mock.calls[0]
    const cuerpo = init?.body as FormData
    expect(url).toMatch(/\/inscripciones\/solicitudes\/solicitud-1\/documentos$/)
    expect(init?.method).toBe('POST')
    expect(init?.headers).toBeUndefined()
    expect(cuerpo.get('tipo_documento')).toBe('DNI del aspirante')
    expect((cuerpo.get('archivo') as File).name).toBe('dni-sofia.pdf')
  })

  it('construye URLs de acceso protegido para ver y descargar archivos', () => {
    const urlVista = urlArchivoDocumentoSolicitudAdmision('solicitud-1', 'documento-1')
    const urlDescarga = urlArchivoDocumentoSolicitudAdmision('solicitud-1', 'documento-1', true)

    expect(urlVista).toContain(
      '/inscripciones/solicitudes/solicitud-1/documentos/documento-1/archivo',
    )
    expect(urlDescarga).toContain('?descargar=true')
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
