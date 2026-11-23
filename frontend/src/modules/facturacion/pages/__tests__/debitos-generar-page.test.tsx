import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DebitosGenerarPage } from '@/modules/facturacion/pages/debitos-generar-page'
import { confirmarRespuestaDebitos } from '@/modules/facturacion/services/confirmar-respuesta-debitos'
import { crearLoteDebitos } from '@/modules/facturacion/services/crear-lote-debitos'
import { descargarArchivoDebitos } from '@/modules/facturacion/services/descargar-archivo-debitos'
import { generarRespuestaDebitos } from '@/modules/facturacion/services/generar-respuesta-debitos'
import { listarFacturasElegiblesDebitos } from '@/modules/facturacion/services/listar-facturas-elegibles-debitos'
import { obtenerFactura } from '@/modules/facturacion/services/obtener-factura'
import { obtenerOpcionesDebitos } from '@/modules/facturacion/services/obtener-opciones-debitos'
import { resumirSeleccionDebitos } from '@/modules/facturacion/services/resumir-seleccion-debitos'
import type {
  FacturaDetalle,
  FacturaElegibleDebito,
  LoteDebitoDetalle,
  ResumenSeleccionDebitos,
} from '@/modules/facturacion/types'

vi.mock('@/modules/facturacion/services/listar-facturas-elegibles-debitos')
vi.mock('@/modules/facturacion/services/obtener-opciones-debitos')
vi.mock('@/modules/facturacion/services/obtener-factura')
vi.mock('@/modules/facturacion/services/resumir-seleccion-debitos')
vi.mock('@/modules/facturacion/services/crear-lote-debitos')
vi.mock('@/modules/facturacion/services/descargar-archivo-debitos')
vi.mock('@/modules/facturacion/services/generar-respuesta-debitos')
vi.mock('@/modules/facturacion/services/confirmar-respuesta-debitos')

function factura(indice: number): FacturaElegibleDebito {
  return {
    id: `factura-${indice}`,
    numero: `F-2026-${String(indice).padStart(5, '0')}`,
    alumno_id: `alumno-${indice}`,
    alumno_nombre: `Alumno ${indice}`,
    curso: '1° A',
    periodo: '2026-10',
    medio: 'cbu',
    fecha_vencimiento: '2026-10-10',
    importe: '172000.00',
    estado: 'pendiente',
    en_lote: false,
  }
}

const paginaUno = Array.from({ length: 10 }, (_, indice) => factura(indice + 1))

const listado = {
  items: paginaUno,
  total: 438,
  pagina: 1,
  tamanio: 10,
  total_pagina: 10,
  ocultas_en_lote: 12,
}

function resumen(
  alcance: 'pagina' | 'filtrados',
  cantidad: number,
  importe: string,
): ResumenSeleccionDebitos {
  return {
    cantidad,
    importe_total: importe,
    por_medio: {
      cbu: { cantidad, importe },
      tarjeta: { cantidad: 0, importe: '0.00' },
    },
    alcance,
    ocultas_en_lote: 12,
  }
}

const lote: LoteDebitoDetalle = {
  id: 'lote-1',
  codigo: 'LD-2026-10-002',
  fecha_exportacion: '2026-10-10',
  periodo: '2026-10',
  cantidad_facturas: 25,
  importe_total: '4300000.00',
  estado: 'exportado',
  resultados_importados: false,
  importacion_id: null,
  liberacion: null,
  items: [],
  solicitudes: [{ nombre: 'ESSERI_DEBITOS_LD-2026-10-002.csv', contenido: 'debitos' }],
}

const detalleFactura: FacturaDetalle = {
  id: 'factura-1',
  fecha_emision: '2026-10-01',
  fecha_vencimiento: '2026-10-10',
  monto_total: '172000.00',
  estado: 'pendiente',
  updated_at: '2026-10-01T10:00:00Z',
  inscripcion_id: 'inscripcion-1',
  responsable_economico_id: 'responsable-1',
  alumno_id: 'alumno-1',
  alumno_nombre: 'Alumno',
  alumno_apellido: 'Uno',
  detalles: [
    {
      id: 'detalle-1',
      descripcion: 'Cuota octubre',
      monto: '172000.00',
      concepto_cobro_id: 'concepto-1',
    },
  ],
  alumno_legajo: 'L-1',
  responsable_economico_nombre: 'Uno, Padre',
  pagos: [],
  recargos: [],
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listarFacturasElegiblesDebitos).mockResolvedValue(listado)
  vi.mocked(obtenerFactura).mockResolvedValue(detalleFactura)
  vi.mocked(obtenerOpcionesDebitos).mockResolvedValue({
    periodos: ['2026-10', '2026-09'],
    medios: ['cbu'],
  })
  vi.mocked(resumirSeleccionDebitos).mockImplementation(
    async ({ modo, factura_ids, excluir_ids }) =>
      modo === 'filtrados'
        ? resumen(
            'filtrados',
            438 - excluir_ids.length,
            String((438 - excluir_ids.length) * 172000),
          )
        : resumen('pagina', factura_ids.length, String(factura_ids.length * 172000)),
  )
  vi.mocked(crearLoteDebitos).mockResolvedValue(lote)
  vi.mocked(generarRespuestaDebitos).mockResolvedValue({
    nombre: 'respuesta.txt',
    contenido: 'respuesta',
  })
})

function renderPage() {
  return render(
    <MemoryRouter>
      <DebitosGenerarPage onIrAImportar={vi.fn()} />
    </MemoryRouter>,
  )
}

describe('DebitosGenerarPage', () => {
  it('renderiza solo las 10 filas de la página aunque el filtro tenga 438 facturas', async () => {
    renderPage()

    expect(await screen.findByText('F-2026-00001')).toBeInTheDocument()
    expect(screen.getAllByText(/^F-2026-/)).toHaveLength(10)
    expect(screen.queryByText('F-2026-00011')).not.toBeInTheDocument()
    expect(screen.getByText('1-10 de 438 facturas')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Alumno 1' })).toHaveAttribute(
      'href',
      '/familias-alumnos/alumnos/alumno-1',
    )
    expect(screen.queryByText(/Archivos de demostración/)).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Exportar 438 solicitudes' })).toBeEnabled()
    expect(listarFacturasElegiblesDebitos).toHaveBeenLastCalledWith(
      expect.objectContaining({ medio: 'cbu' }),
      expect.anything(),
    )
  })

  it('genera siempre sobre un período: sin "Todos" y arranca en el más reciente', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('F-2026-00001')

    const disparador = await screen.findByRole('button', { name: 'Período: Oct 2026' })
    expect(vi.mocked(listarFacturasElegiblesDebitos)).toHaveBeenLastCalledWith(
      expect.objectContaining({ periodo: '2026-10' }),
      expect.anything(),
    )

    await user.click(disparador)

    expect(screen.queryByText('Todos los períodos')).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Oct 2026' })).toBeChecked()
  })

  it('abre el detalle de la factura en un panel lateral al hacer clic en el número', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('F-2026-00001')

    await user.click(screen.getByRole('button', { name: 'F-2026-00001' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(await screen.findByText('Cuota octubre')).toBeInTheDocument()
    expect(screen.getByText('Factura F-2026-00001')).toBeInTheDocument()
    expect(vi.mocked(obtenerFactura)).toHaveBeenCalledWith('factura-1', expect.anything())
  })

  it('excluir una fila marca el cabezal parcial y el cabezal vuelve a incluir todas las elegibles', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('F-2026-00001')

    const cabezal = screen.getByRole('checkbox', {
      name: 'Seleccionar todas las facturas que coinciden con los filtros',
    })

    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar F-2026-00001' }))

    expect(
      await screen.findByText('Seleccionaste 437 facturas que coinciden con los filtros.'),
    ).toBeInTheDocument()
    expect(cabezal).toBePartiallyChecked()
    await waitFor(() => {
      const ultima = vi.mocked(resumirSeleccionDebitos).mock.calls.at(-1)?.[0]
      expect(ultima).toMatchObject({
        modo: 'filtrados',
        factura_ids: [],
        excluir_ids: ['factura-1'],
      })
    })

    await user.click(cabezal)

    expect(
      await screen.findByText('Seleccionaste 438 facturas que coinciden con los filtros.'),
    ).toBeInTheDocument()
    expect(cabezal).toBeChecked()
    await waitFor(() => {
      const ultima = vi.mocked(resumirSeleccionDebitos).mock.calls.at(-1)?.[0]
      expect(ultima).toEqual({
        modo: 'filtrados',
        factura_ids: [],
        filtros: { periodo: '2026-10', medio: 'cbu', estado: 'pendientes_sin_lote' },
        excluir_ids: [],
      })
    })
  })

  it('la selección global persiste al paginar y se limpia al cambiar la búsqueda', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('F-2026-00001')

    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar F-2026-00001' }))
    await user.click(
      screen.getByRole('checkbox', {
        name: 'Seleccionar todas las facturas que coinciden con los filtros',
      }),
    )
    await screen.findByText('Seleccionaste 438 facturas que coinciden con los filtros.')

    await user.click(screen.getByRole('link', { name: '2' }))
    await waitFor(() =>
      expect(vi.mocked(listarFacturasElegiblesDebitos)).toHaveBeenLastCalledWith(
        expect.objectContaining({ pagina: 2 }),
        expect.anything(),
      ),
    )
    expect(
      screen.getByText('Seleccionaste 438 facturas que coinciden con los filtros.'),
    ).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Buscar alumno o factura'), 'García')

    await waitFor(() =>
      expect(vi.mocked(listarFacturasElegiblesDebitos)).toHaveBeenLastCalledWith(
        expect.objectContaining({ buscar: 'García', pagina: 1 }),
        expect.anything(),
      ),
    )
    expect(screen.queryByText(/Seleccionaste las/)).not.toBeInTheDocument()
  })

  it('muestra el resumen de la selección con medios y facturas ocultas', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('F-2026-00001')

    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar F-2026-00001' }))
    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar F-2026-00002' }))

    const resumen = await screen.findByRole('region', { name: 'Resumen del lote' })
    expect(within(resumen).getByText(/436 facturas · todos los filtrados/)).toBeInTheDocument()
    expect(within(resumen).getByText('438')).toBeInTheDocument()
    expect(within(resumen).getByText('12')).toBeInTheDocument()
    expect(within(resumen).getByText(/74\.992\.000/)).toBeInTheDocument()
    expect(screen.getByText(/436 facturas seleccionadas/)).toBeInTheDocument()
  })

  it('exporta el lote CBU con exclusiones sin registrar pagos', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('F-2026-00001')

    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar F-2026-00001' }))
    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar F-2026-00002' }))
    await user.click(await screen.findByRole('button', { name: 'Exportar 436 solicitudes' }))

    await waitFor(() =>
      expect(vi.mocked(crearLoteDebitos)).toHaveBeenCalledWith(
        expect.objectContaining({
          modo: 'filtrados',
          factura_ids: [],
          filtros: { periodo: '2026-10', medio: 'cbu', estado: 'pendientes_sin_lote' },
          excluir_ids: ['factura-1', 'factura-2'],
        }),
        '2026-10',
      ),
    )
    expect(vi.mocked(descargarArchivoDebitos)).not.toHaveBeenCalled()
    expect(await screen.findByText('Lote LD-2026-10-002 exportado')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Descargar débitos (CBU)' }))
    expect(vi.mocked(descargarArchivoDebitos)).toHaveBeenCalledWith(lote.solicitudes[0])

    expect(
      screen.queryByRole('button', { name: 'Descargar créditos (tarjeta)' }),
    ).not.toBeInTheDocument()
    expect(confirmarRespuestaDebitos).not.toHaveBeenCalled()
  })

  it('descarga la respuesta del banco sin salir de la pantalla ni renderizar cientos de filas', async () => {
    const user = userEvent.setup()
    const onIrAImportar = vi.fn()
    render(
      <MemoryRouter>
        <DebitosGenerarPage onIrAImportar={onIrAImportar} />
      </MemoryRouter>,
    )
    await screen.findByText('F-2026-00001')

    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar F-2026-00001' }))
    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar F-2026-00002' }))
    await user.click(await screen.findByRole('button', { name: 'Exportar 436 solicitudes' }))
    await screen.findByText('Lote LD-2026-10-002 exportado')

    await user.click(screen.getByRole('button', { name: 'Descargar respuesta del banco' }))

    await waitFor(() =>
      expect(vi.mocked(generarRespuestaDebitos)).toHaveBeenCalledWith('lote-1', {
        rechazosCantidad: 3,
      }),
    )
    expect(vi.mocked(descargarArchivoDebitos)).toHaveBeenCalledWith({
      nombre: 'respuesta.txt',
      contenido: 'respuesta',
    })
    expect(onIrAImportar).not.toHaveBeenCalled()
    expect(screen.queryByText('Débitos rechazados')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Importar resultados' }))
    expect(onIrAImportar).toHaveBeenCalledTimes(1)
  })

  it('deja un solo rechazo cuando el lote de demo tiene tres facturas', async () => {
    const user = userEvent.setup()
    vi.mocked(crearLoteDebitos).mockResolvedValueOnce({ ...lote, cantidad_facturas: 3 })
    renderPage()
    await screen.findByText('F-2026-00001')

    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar F-2026-00001' }))
    await user.click(await screen.findByRole('button', { name: 'Exportar 437 solicitudes' }))
    await screen.findByText('Lote LD-2026-10-002 exportado')

    await user.click(screen.getByRole('button', { name: 'Descargar respuesta del banco' }))

    await waitFor(() =>
      expect(vi.mocked(generarRespuestaDebitos)).toHaveBeenCalledWith('lote-1', {
        rechazosCantidad: 1,
      }),
    )
  })

  it('muestra la carga mientras espera las facturas', async () => {
    vi.mocked(listarFacturasElegiblesDebitos).mockImplementationOnce(
      () => new Promise(() => undefined),
    )
    renderPage()
    expect(await screen.findByRole('status')).toHaveTextContent('Cargando facturas…')
  })

  it('expone el error con reintento', async () => {
    vi.mocked(listarFacturasElegiblesDebitos).mockRejectedValueOnce(new Error('Sin conexión.'))
    renderPage()
    expect(await screen.findByText('Sin conexión.')).toBeInTheDocument()
    const reintentar = screen.getByRole('button', { name: 'Reintentar' })
    expect(reintentar).toBeEnabled()
  })

  it('muestra el vacío cuando los filtros no tienen facturas', async () => {
    vi.mocked(listarFacturasElegiblesDebitos).mockResolvedValue({
      ...listado,
      items: [],
      total: 0,
      total_pagina: 0,
    })
    renderPage()
    await screen.findByRole('button', { name: 'Período: Oct 2026' })
    expect(await screen.findByText('No hay facturas para estos filtros.')).toBeInTheDocument()
  })
})
