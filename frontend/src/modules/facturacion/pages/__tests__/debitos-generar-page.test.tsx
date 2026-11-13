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
import { obtenerOpcionesDebitos } from '@/modules/facturacion/services/obtener-opciones-debitos'
import { resumirSeleccionDebitos } from '@/modules/facturacion/services/resumir-seleccion-debitos'
import type {
  FacturaElegibleDebito,
  LoteDebitoDetalle,
  ResumenSeleccionDebitos,
} from '@/modules/facturacion/types'

vi.mock('@/modules/facturacion/services/listar-facturas-elegibles-debitos')
vi.mock('@/modules/facturacion/services/obtener-opciones-debitos')
vi.mock('@/modules/facturacion/services/resumir-seleccion-debitos')
vi.mock('@/modules/facturacion/services/crear-lote-debitos')
vi.mock('@/modules/facturacion/services/descargar-archivo-debitos')
vi.mock('@/modules/facturacion/services/generar-respuesta-debitos')
vi.mock('@/modules/facturacion/services/confirmar-respuesta-debitos')

function factura(indice: number): FacturaElegibleDebito {
  return {
    id: `factura-${indice}`,
    numero: `F-2026-${String(indice).padStart(5, '0')}`,
    alumno_nombre: `Alumno ${indice}`,
    curso: '1° A',
    periodo: '2026-10',
    medio: indice % 2 === 0 ? 'cbu' : 'tarjeta',
    fecha_vencimiento: '2026-10-10',
    importe: '172000.00',
    estado: 'pendiente',
    en_lote: false,
  }
}

const paginaUno = Array.from({ length: 25 }, (_, indice) => factura(indice + 1))

const listado = {
  items: paginaUno,
  total: 438,
  pagina: 1,
  tamanio: 25,
  total_pagina: 25,
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
      cbu: { cantidad: 15, importe: '2580000.00' },
      tarjeta: { cantidad: 10, importe: '1720000.00' },
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
  solicitudes: [
    { nombre: 'ESSERI_DEBITOS_LD-2026-10-002.csv', contenido: 'debitos' },
    { nombre: 'ESSERI_CREDITOS_LD-2026-10-002.csv', contenido: 'creditos' },
  ],
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listarFacturasElegiblesDebitos).mockResolvedValue(listado)
  vi.mocked(obtenerOpcionesDebitos).mockResolvedValue({
    periodos: ['2026-10', '2026-09'],
    medios: ['cbu', 'tarjeta'],
  })
  vi.mocked(resumirSeleccionDebitos).mockImplementation(async ({ modo, factura_ids }) =>
    modo === 'filtrados'
      ? resumen('filtrados', 438, '75480000.00')
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
  it('renderiza solo las 25 filas de la página aunque el filtro tenga 438 facturas', async () => {
    renderPage()

    expect(await screen.findByText('F-2026-00001')).toBeInTheDocument()
    expect(screen.getAllByText(/^F-2026-/)).toHaveLength(25)
    expect(screen.queryByText('F-2026-00026')).not.toBeInTheDocument()
    expect(screen.getByText('1-25 de 438 facturas')).toBeInTheDocument()
    expect(screen.queryByText(/Archivos de demostración/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exportar 0 solicitudes' })).toBeInTheDocument()
  })

  it('seleccionar una fila marca el cabezal parcial y el cabezal elige todos los filtrados', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('F-2026-00001')

    const cabezal = screen.getByRole('checkbox', {
      name: 'Seleccionar todas las facturas que coinciden con los filtros',
    })

    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar F-2026-00001' }))

    expect(
      await screen.findByText('Seleccionaste 1 factura de esta página.'),
    ).toBeInTheDocument()
    expect(cabezal).toBePartiallyChecked()
    await waitFor(() => {
      const ultima = vi.mocked(resumirSeleccionDebitos).mock.calls.at(-1)?.[0]
      expect(ultima).toMatchObject({ modo: 'pagina', factura_ids: ['factura-1'] })
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
        filtros: { estado: 'pendientes_sin_lote' },
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

    const resumenPanel = await screen.findByRole('complementary', { name: 'Resumen del lote' })
    expect(within(resumenPanel).getByText('Selección: solo esta página')).toBeInTheDocument()
    expect(within(resumenPanel).getByText('2')).toBeInTheDocument()
    expect(within(resumenPanel).getByText('15')).toBeInTheDocument()
    expect(within(resumenPanel).getByText('10')).toBeInTheDocument()
    expect(within(resumenPanel).getByText('438')).toBeInTheDocument()
    expect(within(resumenPanel).getByText('12')).toBeInTheDocument()
    expect(within(resumenPanel).getByText(/344\.000/)).toBeInTheDocument()
  })

  it('exporta el lote y ofrece la descarga de cada plataforma sin registrar pagos', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('F-2026-00001')

    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar F-2026-00001' }))
    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar F-2026-00002' }))
    await user.click(await screen.findByRole('button', { name: 'Exportar 2 solicitudes' }))

    await waitFor(() =>
      expect(vi.mocked(crearLoteDebitos)).toHaveBeenCalledWith(
        expect.objectContaining({
          modo: 'pagina',
          factura_ids: ['factura-1', 'factura-2'],
        }),
        undefined,
      ),
    )
    expect(vi.mocked(descargarArchivoDebitos)).not.toHaveBeenCalled()
    expect(await screen.findByText('Lote LD-2026-10-002 exportado')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Descargar débitos (CBU)' }))
    expect(vi.mocked(descargarArchivoDebitos)).toHaveBeenCalledWith(lote.solicitudes[0])

    await user.click(screen.getByRole('button', { name: 'Descargar créditos (tarjeta)' }))
    expect(vi.mocked(descargarArchivoDebitos)).toHaveBeenCalledWith(lote.solicitudes[1])
    expect(confirmarRespuestaDebitos).not.toHaveBeenCalled()
  })

  it('genera una respuesta de ejemplo y salta a importar sin renderizar cientos de filas', async () => {
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
    await user.click(await screen.findByRole('button', { name: 'Exportar 2 solicitudes' }))
    await screen.findByText('Lote LD-2026-10-002 exportado')

    await user.click(screen.getByRole('button', { name: 'Preparar respuesta de ejemplo' }))

    await waitFor(() =>
      expect(vi.mocked(generarRespuestaDebitos)).toHaveBeenCalledWith('lote-1', {
        rechazosCantidad: 3,
      }),
    )
    expect(vi.mocked(descargarArchivoDebitos)).toHaveBeenCalledWith({
      nombre: 'respuesta.txt',
      contenido: 'respuesta',
    })
    expect(onIrAImportar).toHaveBeenCalled()
    expect(screen.queryByText('Débitos rechazados')).not.toBeInTheDocument()
  })

  it('muestra la carga mientras espera las facturas', () => {
    vi.mocked(listarFacturasElegiblesDebitos).mockImplementationOnce(
      () => new Promise(() => undefined),
    )
    renderPage()
    expect(screen.getByRole('status')).toHaveTextContent('Cargando facturas…')
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
    expect(await screen.findByText('No hay facturas para estos filtros.')).toBeInTheDocument()
  })
})
