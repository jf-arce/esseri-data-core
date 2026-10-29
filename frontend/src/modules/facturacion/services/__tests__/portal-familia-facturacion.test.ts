import { afterEach, describe, expect, it, vi } from 'vitest'
import { descargarExport } from '@/lib/descargar-export'
import { descargarComprobantePagoFamilia } from '@/modules/facturacion/services/descargar-comprobante-pago-familia'
import { listarFacturacionFamilia } from '@/modules/facturacion/services/listar-facturacion-familia'

vi.mock('@/lib/descargar-export')

const mockedDescargarExport = vi.mocked(descargarExport)

function respuestaOk() {
  return new Response(JSON.stringify({ facturas: [], movimientos: [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('servicios de facturación del portal de familia', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('consulta solo los datos de facturación de la familia autenticada', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await listarFacturacionFamilia()

    expect(fetchMock.mock.calls[0][0]).toContain('/facturacion/familia/me')
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'include' })
  })

  it('descarga el comprobante a través de la ruta familiar autenticada', async () => {
    await descargarComprobantePagoFamilia('pago-1')

    expect(mockedDescargarExport).toHaveBeenCalledWith(
      '/facturacion/familia/me/pagos/pago-1/comprobante',
      'comprobante-pago-1',
    )
  })
})
