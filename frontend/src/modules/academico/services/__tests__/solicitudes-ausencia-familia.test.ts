import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { descargarExport } from '@/lib/descargar-export'
import {
  cancelarSolicitudAusencia,
  crearSolicitudAusenciaPeriodo,
  descargarComprobanteSolicitudAusencia,
  listarSolicitudesAusenciaFamilia,
} from '@/modules/academico/services/solicitudes-ausencia-familia'

vi.mock('@/api/client', () => ({ apiClient: vi.fn() }))
vi.mock('@/lib/descargar-export')

const mockedApiClient = vi.mocked(apiClient)
const mockedDescargarExport = vi.mocked(descargarExport)

beforeEach(() => {
  vi.clearAllMocks()
  mockedApiClient.mockResolvedValue({} as never)
  mockedDescargarExport.mockResolvedValue(undefined)
})

describe('solicitudes de ausencia por período', () => {
  it('crea la solicitud con los campos del formulario y el comprobante', async () => {
    const comprobante = new File(['%PDF-1.4'], 'reposo.pdf', { type: 'application/pdf' })

    await crearSolicitudAusenciaPeriodo({
      alumno_id: 'alumno-1',
      fecha_inicio: '2027-03-01',
      fecha_fin: '2027-03-05',
      motivo: 'enfermedad',
      observacion: 'Reposo',
      comprobante,
    })

    const [ruta, init] = mockedApiClient.mock.calls[0]
    expect(ruta).toBe('/academico/familia/solicitudes-ausencia')
    expect(init?.method).toBe('POST')
    const cuerpo = init?.body as FormData
    expect(cuerpo.get('alumno_id')).toBe('alumno-1')
    expect(cuerpo.get('fecha_inicio')).toBe('2027-03-01')
    expect(cuerpo.get('fecha_fin')).toBe('2027-03-05')
    expect(cuerpo.get('motivo')).toBe('enfermedad')
    expect(cuerpo.get('observacion')).toBe('Reposo')
    expect((cuerpo.get('comprobante') as File).name).toBe('reposo.pdf')
  })

  it('lista y cancela contra las rutas familiares', async () => {
    await listarSolicitudesAusenciaFamilia('alumno-1')
    await cancelarSolicitudAusencia('solicitud-1')

    expect(mockedApiClient).toHaveBeenNthCalledWith(
      1,
      '/academico/familia/alumnos/alumno-1/solicitudes-ausencia',
    )
    expect(mockedApiClient).toHaveBeenNthCalledWith(
      2,
      '/academico/familia/solicitudes-ausencia/solicitud-1/cancelar',
      { method: 'POST' },
    )
  })

  it('descarga el comprobante de la solicitud', async () => {
    await descargarComprobanteSolicitudAusencia('solicitud-1', 'reposo.pdf')

    expect(mockedDescargarExport).toHaveBeenCalledWith(
      '/academico/familia/solicitudes-ausencia/solicitud-1/archivo',
      'reposo.pdf',
    )
  })
})
