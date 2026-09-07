import { afterEach, describe, expect, it, vi } from 'vitest'
import { crearFactura } from '@/modules/facturacion/services/crear-factura'
import { crearReglaFacturacion } from '@/modules/facturacion/services/crear-regla-facturacion'
import { generarFacturacion } from '@/modules/facturacion/services/generar-facturacion'
import { listarConceptosCobro } from '@/modules/facturacion/services/listar-conceptos-cobro'
import { listarFacturas } from '@/modules/facturacion/services/listar-facturas'
import { previsualizarGeneracionFacturacion } from '@/modules/facturacion/services/previsualizar-generacion-facturacion'

const respuestaOk = () =>
  new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

describe('servicios de facturación', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('envía filtros combinables y orden al consultar facturas', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await listarFacturas({
      pagina: 2,
      tamanio: 10,
      estado: 'pendiente',
      buscar: 'c4341acf',
      alumnoId: 'alumno-1',
      conceptoCobroId: 'concepto-1',
      ordenarPor: 'monto_total',
      direccion: 'desc',
    })

    expect(fetchMock.mock.calls[0][0]).toContain(
      '/facturacion/facturas?pagina=2&tamanio=10&estado=pendiente&buscar=c4341acf&alumno_id=alumno-1&concepto_cobro_id=concepto-1&ordenar_por=monto_total&direccion=desc',
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

  it('crea una regla recurrente con sus condiciones de aplicación', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())
    const payload = {
      nombre: 'Cuota primaria',
      descripcion: null,
      ciclo_lectivo: '2027',
      concepto_cobro_id: '8811698c-6856-4534-a0f8-f4aa955a70af',
      importe: '125000.00',
      periodicidad: 'mensual' as const,
      vigencia_desde: '2027-03-01',
      vigencia_hasta: '2027-12-31',
      mes_aplicacion: null,
      modo_generacion: 'automatica' as const,
      dia_generacion: 1,
      dia_vencimiento: 5,
      criterio_aplicacion: 'todas_inscripciones' as const,
      nivel_educativo_id: null,
      anio_id: null,
      division_id: null,
      estado: 'activa' as const,
    }

    await crearReglaFacturacion(payload)

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/facturacion\/reglas$/)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' })
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual(payload)
  })

  it('previsualiza antes de confirmar la generación recurrente', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await previsualizarGeneracionFacturacion('2027-03-01')
    await generarFacturacion('2027-03-01')

    expect(fetchMock.mock.calls[0][0]).toContain('/reglas/generaciones/previsualizar')
    expect(fetchMock.mock.calls[1][0]).toContain('/reglas/generaciones')
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' })
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST' })
  })
})
