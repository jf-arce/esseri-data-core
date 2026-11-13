import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DebitosHistorialPage } from '@/modules/facturacion/pages/debitos-historial-page'
import { descargarArchivoDebitos } from '@/modules/facturacion/services/descargar-archivo-debitos'
import { liberarLoteDebitos } from '@/modules/facturacion/services/liberar-lote-debitos'
import { listarLiberacionesDebitos } from '@/modules/facturacion/services/listar-liberaciones-debitos'
import { listarLotesDebitos } from '@/modules/facturacion/services/listar-lotes-debitos'
import { obtenerLoteDebitos } from '@/modules/facturacion/services/obtener-lote-debitos'
import { obtenerOpcionesDebitos } from '@/modules/facturacion/services/obtener-opciones-debitos'
import type {
  HistorialLotesDebitos,
  LiberacionesDebitos,
  LoteDebitoDetalle,
  LoteDebitoResumen,
} from '@/modules/facturacion/types'

vi.mock('@/modules/facturacion/services/listar-lotes-debitos')
vi.mock('@/modules/facturacion/services/listar-liberaciones-debitos')
vi.mock('@/modules/facturacion/services/obtener-lote-debitos')
vi.mock('@/modules/facturacion/services/liberar-lote-debitos')
vi.mock('@/modules/facturacion/services/descargar-archivo-debitos')
vi.mock('@/modules/facturacion/services/obtener-opciones-debitos')

const exportado: LoteDebitoResumen = {
  id: 'lote-1',
  codigo: 'LD-2026-10-001',
  fecha_exportacion: '2026-10-05',
  periodo: '2026-10',
  cantidad_facturas: 12,
  importe_total: '2064000.00',
  estado: 'exportado',
  resultados_importados: false,
  importacion_id: null,
  liberacion: null,
}

const enRevision: LoteDebitoResumen = {
  id: 'lote-2',
  codigo: 'LD-2026-10-002',
  fecha_exportacion: '2026-10-10',
  periodo: '2026-10',
  cantidad_facturas: 438,
  importe_total: '75480000.00',
  estado: 'en_revision',
  resultados_importados: true,
  importacion_id: 'imp-1',
  liberacion: null,
}

const pagos: LoteDebitoResumen = {
  id: 'lote-3',
  codigo: 'LD-2026-09-001',
  fecha_exportacion: '2026-09-09',
  periodo: '2026-09',
  cantidad_facturas: 431,
  importe_total: '70092000.00',
  estado: 'pagos_registrados',
  resultados_importados: true,
  importacion_id: 'imp-2',
  liberacion: null,
}

const liberado: LoteDebitoResumen = {
  id: 'lote-4',
  codigo: 'LD-2026-09-002',
  fecha_exportacion: '2026-09-13',
  periodo: '2026-09',
  cantidad_facturas: 9,
  importe_total: '1548000.00',
  estado: 'liberado',
  resultados_importados: false,
  importacion_id: null,
  liberacion: {
    usuario_id: 'user-1',
    usuario_nombre: 'Administración',
    fecha: '2026-10-13T13:00:00Z',
    motivo: 'Banco rechazó el archivo completo',
  },
}

const historial: HistorialLotesDebitos = {
  items: [exportado, enRevision, pagos, liberado],
  total: 4,
  pagina: 1,
  tamanio: 25,
}

const liberaciones: LiberacionesDebitos = {
  items: [
    {
      lote_id: 'lote-4',
      codigo: 'LD-2026-09-002',
      cantidad_facturas: 9,
      usuario_id: 'user-1',
      usuario_nombre: 'Administración',
      fecha: '2026-10-13T13:00:00Z',
      motivo: 'Banco rechazó el archivo completo',
    },
  ],
  total: 1,
  pagina: 1,
  tamanio: 25,
}

const detalle: LoteDebitoDetalle = {
  ...pagos,
  items: [
    {
      referencia: 'ref-1',
      factura_id: 'factura-1',
      numero: 'F-202609-0001',
      alumno_nombre: 'Demo, Alumno 431',
      importe: '172000.00',
      vencimiento: '2026-09-10',
      concepto: 'Cuota septiembre',
      resultado: 'COBRADO_SIM',
      pago_id: 'pago-1',
    },
  ],
  solicitudes: [
    { nombre: 'ESSERI_DEBITOS_LD-2026-09-001.csv', contenido: 'debitos' },
    { nombre: 'ESSERI_CREDITOS_LD-2026-09-001.csv', contenido: 'creditos' },
  ],
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listarLotesDebitos).mockResolvedValue(historial)
  vi.mocked(listarLiberacionesDebitos).mockResolvedValue(liberaciones)
  vi.mocked(obtenerLoteDebitos).mockResolvedValue(detalle)
  vi.mocked(liberarLoteDebitos).mockResolvedValue({ ...exportado, estado: 'liberado' })
  vi.mocked(obtenerOpcionesDebitos).mockResolvedValue({
    periodos: ['2026-10', '2026-09'],
    medios: ['cbu', 'tarjeta'],
  })
})

function renderPage(overrides?: {
  onContinuarRevision?: (id: string) => void
  onImportar?: () => void
}) {
  return render(
    <DebitosHistorialPage
      onContinuarRevision={overrides?.onContinuarRevision ?? vi.fn()}
      onImportar={overrides?.onImportar ?? vi.fn()}
    />,
  )
}

describe('DebitosHistorialPage', () => {
  it('ajusta las filas del detalle al espacio disponible al cambiar el tamaño', async () => {
    const observadas = new Map<Element, () => void>()
    const resizeObserverOriginal = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
        private callback: () => void
        constructor(callback: () => void) {
          this.callback = callback
        }
        observe(element: Element) {
          observadas.set(element, this.callback)
        }
        disconnect() {}
        unobserve() {}
      } as unknown as typeof ResizeObserver
    try {
      const user = userEvent.setup()
      vi.mocked(obtenerLoteDebitos).mockResolvedValue({
        ...detalle,
        cantidad_facturas: 14,
        items: Array.from({ length: 14 }, (_, indice) => ({
          ...detalle.items[0],
          referencia: `ref-${indice}`,
          numero: `F-${indice}`,
        })),
      })
      renderPage()
      await user.click(
        await screen.findByRole('button', { name: `Acciones del lote ${pagos.codigo}` }),
      )
      await user.click(screen.getByRole('menuitem', { name: 'Ver detalle' }))
      const sheet = await screen.findByRole('dialog')
      const tabla = await within(sheet).findByRole('table')
      const contenedor = tabla.parentElement!
      let alto = 442
      Object.defineProperty(contenedor, 'clientHeight', { get: () => alto })
      vi.spyOn(tabla.querySelector('thead')!, 'getBoundingClientRect').mockReturnValue({
        height: 40,
      } as DOMRect)
      vi.spyOn(tabla.querySelector('tbody tr')!, 'getBoundingClientRect').mockReturnValue({
        height: 40,
      } as DOMRect)
      expect(observadas.has(contenedor)).toBe(true)
      act(() => observadas.get(contenedor)!())
      expect(within(sheet).getByText('1-10 de 14 facturas')).toBeInTheDocument()
      expect(within(tabla).getAllByRole('row')).toHaveLength(11)

      alto = 242
      act(() => observadas.get(contenedor)!())
      expect(within(sheet).getByText('1-5 de 14 facturas')).toBeInTheDocument()
      expect(within(tabla).getAllByRole('row')).toHaveLength(6)
    } finally {
      globalThis.ResizeObserver = resizeObserverOriginal
      vi.restoreAllMocks()
    }
  })

  it('pagina el detalle en grupos de 11 y vuelve a la primera página al buscar', async () => {
    const user = userEvent.setup()
    const items = Array.from({ length: 14 }, (_, indice) => ({
      ...detalle.items[0],
      referencia: `ref-${indice + 1}`,
      factura_id: `factura-${indice + 1}`,
      numero: `F-202609-${String(indice + 1).padStart(4, '0')}`,
      alumno_nombre: `Alumno ${indice + 1}`,
    }))
    vi.mocked(obtenerLoteDebitos).mockResolvedValue({
      ...detalle,
      cantidad_facturas: 14,
      items,
    })
    renderPage()
    await user.click(
      await screen.findByRole('button', { name: `Acciones del lote ${pagos.codigo}` }),
    )
    await user.click(screen.getByRole('menuitem', { name: 'Ver detalle' }))
    const sheet = await screen.findByRole('dialog')
    expect(await within(sheet).findByText('1-11 de 14 facturas')).toBeInTheDocument()
    expect(within(sheet).getAllByRole('row')).toHaveLength(12)
    expect(within(sheet).queryByText('F-202609-0014')).not.toBeInTheDocument()

    await user.click(within(sheet).getByRole('link', { name: '2' }))
    expect(within(sheet).getByText('12-14 de 14 facturas')).toBeInTheDocument()
    expect(within(sheet).getAllByRole('row')).toHaveLength(4)
    expect(within(sheet).getByText('F-202609-0014')).toBeInTheDocument()

    await user.type(within(sheet).getByPlaceholderText('Buscar alumno o factura'), 'Alumno 14')
    expect(within(sheet).getByText('1-1 de 1 facturas')).toBeInTheDocument()
    expect(within(sheet).getByText('F-202609-0014')).toBeInTheDocument()
    expect(within(sheet).getByText('Total del lote')).toBeInTheDocument()
    await user.clear(within(sheet).getByPlaceholderText('Buscar alumno o factura'))
    expect(within(sheet).getByText('1-11 de 14 facturas')).toBeInTheDocument()
  })

  it.each([exportado, enRevision, pagos, liberado])(
    'permite ver el detalle de un lote en estado $estado',
    async (lote) => {
      const user = userEvent.setup()
      vi.mocked(obtenerLoteDebitos).mockResolvedValue({ ...detalle, ...lote })
      renderPage()
      await user.click(
        await screen.findByRole('button', { name: `Acciones del lote ${lote.codigo}` }),
      )
      await user.click(screen.getByRole('menuitem', { name: 'Ver detalle' }))
      expect(obtenerLoteDebitos).toHaveBeenCalledWith(lote.id, expect.anything())
      const sheet = await screen.findByRole('dialog')
      expect(await within(sheet).findByText(`Lote ${lote.codigo}`)).toBeInTheDocument()
    },
  )

  it('agrupa las acciones por estado en el menú de cada fila', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('LD-2026-10-001')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Acciones del lote/ })).toHaveLength(4)
    expect(screen.getAllByText('Exportado')).toHaveLength(2)
    expect(screen.getByText('En revisión')).toBeInTheDocument()
    expect(screen.getByText('Pagos registrados')).toBeInTheDocument()
    expect(screen.getByText('Liberado')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Acciones del lote LD-2026-10-001' }))
    expect(screen.getByRole('menuitem', { name: 'Importar resultados' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Liberar lote' })).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: 'Acciones del lote LD-2026-10-002' }))
    expect(screen.getByRole('menuitem', { name: 'Continuar revisión' })).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: 'Acciones del lote LD-2026-09-001' }))
    expect(screen.getByRole('menuitem', { name: 'Ver detalle' })).toBeInTheDocument()
  })

  it('no ofrece liberar un lote que ya tiene resultados o una revisión persistida', async () => {
    const user = userEvent.setup()
    vi.mocked(listarLotesDebitos).mockResolvedValue({
      ...historial,
      items: [{ ...exportado, resultados_importados: true }],
      total: 1,
    })
    renderPage()

    expect(await screen.findByText('LD-2026-10-001')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Acciones del lote LD-2026-10-001' }))
    expect(screen.getByRole('menuitem', { name: 'Importar resultados' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Liberar lote' })).not.toBeInTheDocument()
  })

  it('continuar revisión entrega el ID durable de la importación', async () => {
    const user = userEvent.setup()
    const onContinuarRevision = vi.fn()
    renderPage({ onContinuarRevision })

    await screen.findByText('LD-2026-10-002')
    await user.click(screen.getByRole('button', { name: 'Acciones del lote LD-2026-10-002' }))
    await user.click(screen.getByRole('menuitem', { name: 'Continuar revisión' }))

    expect(onContinuarRevision).toHaveBeenCalledWith('imp-1')
  })

  it('importar resultados abre la pestaña de importación', async () => {
    const user = userEvent.setup()
    const onImportar = vi.fn()
    renderPage({ onImportar })

    await screen.findByText('LD-2026-10-001')
    await user.click(screen.getByRole('button', { name: 'Acciones del lote LD-2026-10-001' }))
    await user.click(screen.getByRole('menuitem', { name: 'Importar resultados' }))

    expect(onImportar).toHaveBeenCalled()
  })

  it('libera con motivo y confirmación explícita y refresca historial y registro', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('LD-2026-10-001')

    await user.click(screen.getByRole('button', { name: 'Acciones del lote LD-2026-10-001' }))
    await user.click(screen.getByRole('menuitem', { name: 'Liberar lote' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Liberar lote LD-2026-10-001')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Liberar 12 facturas' })).toBeDisabled()

    await user.click(
      within(dialog).getByRole('checkbox', {
        name: 'Confirmo que el banco no procesó este lote.',
      }),
    )
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Motivo' }),
      'El banco no procesó el archivo',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Liberar 12 facturas' }))

    await waitFor(() =>
      expect(vi.mocked(liberarLoteDebitos)).toHaveBeenCalledWith('lote-1', {
        motivo: 'El banco no procesó el archivo',
        confirmacion_no_procesado: true,
      }),
    )
    await waitFor(() => expect(vi.mocked(listarLotesDebitos)).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(vi.mocked(listarLiberacionesDebitos)).toHaveBeenCalledTimes(2))
  })

  it('ver detalle carga el lote y permite descargar la solicitud', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('LD-2026-09-001')

    const filas = screen.getByText('LD-2026-09-001').closest('tr')
    expect(filas).not.toBeNull()
    await user.click(
      within(filas as HTMLElement).getByRole('button', {
        name: 'Acciones del lote LD-2026-09-001',
      }),
    )
    await user.click(screen.getByRole('menuitem', { name: 'Ver detalle' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Lote LD-2026-09-001')).toBeInTheDocument()
    expect(within(dialog).getByText('Concepto: Cuota septiembre')).toBeInTheDocument()
    expect(within(dialog).getByText('F-202609-0001')).toBeInTheDocument()
    expect(within(dialog).getByText('Demo, Alumno 431')).toBeInTheDocument()
    expect(within(dialog).getByText('Resultado')).toBeInTheDocument()
    expect(within(dialog).getByText('Cobrado')).toBeInTheDocument()
    expect(
      within(dialog).getByPlaceholderText('Buscar alumno o factura'),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('Total del lote')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Descargar archivos del lote' }))
    await user.click(screen.getByRole('menuitem', { name: 'Débitos (CBU)' }))
    expect(vi.mocked(descargarArchivoDebitos)).toHaveBeenCalledWith(detalle.solicitudes[0])
    await user.click(within(dialog).getByRole('button', { name: 'Descargar archivos del lote' }))
    await user.click(screen.getByRole('menuitem', { name: 'Créditos (tarjeta)' }))
    expect(vi.mocked(descargarArchivoDebitos)).toHaveBeenCalledWith(detalle.solicitudes[1])
  })

  it('busca facturas por alumno o número dentro del detalle', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('LD-2026-09-001')
    await user.click(screen.getByRole('button', { name: 'Acciones del lote LD-2026-09-001' }))
    await user.click(screen.getByRole('menuitem', { name: 'Ver detalle' }))

    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText('Buscar alumno o factura'), 'inexistente')

    expect(
      within(dialog).getByText('No hay facturas que coincidan con la búsqueda.'),
    ).toBeInTheDocument()
    await user.clear(within(dialog).getByPlaceholderText('Buscar alumno o factura'))
    expect(within(dialog).getByText('F-202609-0001')).toBeInTheDocument()
  })

  it('pagina el historial desde el servidor', async () => {
    const user = userEvent.setup()
    vi.mocked(listarLotesDebitos).mockResolvedValue({
      ...historial,
      total: 30,
    })
    renderPage()
    await screen.findByText('LD-2026-10-001')

    await user.click(screen.getByRole('link', { name: '2' }))

    await waitFor(() =>
      expect(vi.mocked(listarLotesDebitos)).toHaveBeenLastCalledWith(
        expect.objectContaining({ pagina: 2, tamanio: 25 }),
        expect.anything(),
      ),
    )
  })

  it('muestra el registro de liberaciones con usuario, fecha y motivo', async () => {
    renderPage()

    expect(await screen.findByText(/Administración liberó LD-2026-09-002/)).toBeInTheDocument()
    expect(screen.getByText(/Banco rechazó el archivo completo/)).toBeInTheDocument()
  })

  it('expone carga, error con reintento y vacío', async () => {
    vi.mocked(listarLotesDebitos).mockImplementationOnce(() => new Promise(() => undefined))
    renderPage()
    expect(screen.getByRole('status')).toHaveTextContent('Cargando lotes…')
  })

  it('expone el error del historial y permite reintentar', async () => {
    vi.mocked(listarLotesDebitos).mockRejectedValueOnce(new Error('Sin conexión.'))
    renderPage()
    expect(await screen.findByText('Sin conexión.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeEnabled()
  })

  it('muestra el vacío cuando no hay lotes', async () => {
    vi.mocked(listarLotesDebitos).mockResolvedValue({
      items: [],
      total: 0,
      pagina: 1,
      tamanio: 25,
    })
    vi.mocked(listarLiberacionesDebitos).mockResolvedValue({
      items: [],
      total: 0,
      pagina: 1,
      tamanio: 25,
    })
    renderPage()
    expect(await screen.findByText('Todavía no hay lotes exportados.')).toBeInTheDocument()
    expect(screen.getByText('Todavía no se liberó ningún lote.')).toBeInTheDocument()
  })
})
