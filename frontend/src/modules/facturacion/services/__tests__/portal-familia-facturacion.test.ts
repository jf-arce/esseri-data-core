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

it('completa el vencimiento efectivo cuando el backend no lo envía', async () => {
  const factura = {
    id: 'factura-1',
    alumno_id: 'alumno-1',
    fecha_emision: '2026-03-01',
    fecha_vencimiento: '2026-03-10',
    monto_total: '125.00',
    estado: 'pendiente',
    alumno_nombre: 'Tiziano Cabral',
  }
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          total_debe: '125.00',
          total_haber: '0.00',
          saldo: '125.00',
          facturas: [factura],
          movimientos: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
  )

  const cuenta = await listarFacturacionFamilia()

  expect(cuenta.facturas[0].fecha_vencimiento_efectiva).toBe('2026-03-10')
  expect(cuenta.facturas[0].detalles).toEqual([])
  expect(cuenta.facturas[0].pagos).toEqual([])
})
