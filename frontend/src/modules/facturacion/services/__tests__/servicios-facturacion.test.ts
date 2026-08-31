import { afterEach, describe, expect, it, vi } from 'vitest'
import { crearFactura } from '@/modules/facturacion/services/crear-factura'
import { listarConceptosCobro } from '@/modules/facturacion/services/listar-conceptos-cobro'
import { listarFacturas } from '@/modules/facturacion/services/listar-facturas'

const respuestaOk = () =>
  new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

describe('servicios de facturación', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('envía paginación y estado al consultar facturas', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await listarFacturas({ pagina: 2, tamanio: 10, estado: 'pendiente' })

    expect(fetchMock.mock.calls[0][0]).toContain(
      '/facturacion/facturas?pagina=2&tamanio=10&estado=pendiente',
    )
  })

  it('solicita el catálogo de conceptos de cobro', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await listarConceptosCobro()

    expect(fetchMock.mock.calls[0][0]).toContain('/facturacion/conceptos')
  })

  it('crea una factura con su inscripción y sus detalles', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())
    const payload = {
      inscripcion_id: 'cb5f3d7f-8324-4f13-90e0-26f3ef7f6990',
      fecha_emision: '2027-03-01',
      fecha_vencimiento: '2027-03-10',
      detalles: [
        {
          concepto_cobro_id: '8811698c-6856-4534-a0f8-f4aa955a70af',
          descripcion: 'Matrícula 2027',
          monto: '120000.00',
        },
      ],
    }

    await crearFactura(payload)

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/facturacion\/facturas$/)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' })
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual(payload)
  })
})
