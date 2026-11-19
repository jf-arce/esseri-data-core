import { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DebitosImportarPage } from '@/modules/facturacion/pages/debitos-importar-page'
import { confirmarRespuestaDebitos } from '@/modules/facturacion/services/confirmar-respuesta-debitos'
import { descargarArchivoDebitos } from '@/modules/facturacion/services/descargar-archivo-debitos'
import { descargarIncidenciasDebitos } from '@/modules/facturacion/services/descargar-incidencias-debitos'
import { obtenerImportacionDebitos } from '@/modules/facturacion/services/obtener-importacion-debitos'
import { previsualizarRespuestaDebitos } from '@/modules/facturacion/services/previsualizar-respuesta-debitos'
import type { ImportacionDebitosRead } from '@/modules/facturacion/types'

vi.mock('@/modules/facturacion/services/obtener-importacion-debitos')
vi.mock('@/modules/facturacion/services/previsualizar-respuesta-debitos')
vi.mock('@/modules/facturacion/services/confirmar-respuesta-debitos')
vi.mock('@/modules/facturacion/services/descargar-incidencias-debitos')
vi.mock('@/modules/facturacion/services/descargar-archivo-debitos')

const revision: ImportacionDebitosRead = {
  id: 'imp-1',
  lote_id: 'lote-1',
  lote_codigo: 'LD-2026-10-002',
  estado: 'en_revision',
  archivo_hash: 'hash-1',
  errores: [],
  puede_confirmar: true,
  resumen: {
    procesados: { cantidad: 438, importe: '75480000.00' },
    cobrados: { cantidad: 401, importe: '69127500.00' },
    rechazados: { cantidad: 31, importe: '5342500.00' },
    errores: { cantidad: 0, importe: '0.00' },
  },
  items: [
    {
      linea: 1,
      referencia: 'ref-1',
      factura_id: 'factura-1',
      numero_factura: 'F-2026-01219',
      alumno_nombre: 'Sofía Carrizo',
      resultado: 'RECHAZADO_SIM',
      importe: '185000.00',
      estado: 'rechazado',
      mensaje: 'Rechazo informado: SIM01 — Fondos insuficientes.',
      pago_id: null,
    },
  ],
  total: 37,
  pagina: 1,
  tamanio: 25,
}

const previewConError: ImportacionDebitosRead = {
  ...revision,
  puede_confirmar: false,
  resumen: {
    ...revision.resumen,
    errores: { cantidad: 1, importe: '172000.00' },
  },
  items: [
    {
      linea: 2,
      referencia: 'ref-2',
      factura_id: null,
      numero_factura: 'F-2026-09999',
      alumno_nombre: null,
      resultado: 'COBRADO_SIM',
      importe: '172000.00',
      estado: 'error',
      mensaje: 'Factura no encontrada en el lote.',
      pago_id: null,
    },
  ],
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(obtenerImportacionDebitos).mockImplementation(async (id) =>
    id === 'imp-2'
      ? {
          ...revision,
          id: 'imp-2',
          total: 10,
          items: [],
          resumen: {
            procesados: { cantidad: 10, importe: '1000000.00' },
            cobrados: { cantidad: 10, importe: '1000000.00' },
            rechazados: { cantidad: 0, importe: '0.00' },
            errores: { cantidad: 0, importe: '0.00' },
          },
        }
      : revision,
  )
  vi.mocked(confirmarRespuestaDebitos).mockResolvedValue({
    ...revision,
    estado: 'confirmada',
    puede_confirmar: false,
    items: [{ ...revision.items[0], estado: 'rechazado' }],
    total: 1,
  })
  vi.mocked(descargarIncidenciasDebitos).mockResolvedValue({
    nombre: 'incidencias.csv',
    contenido: 'csv',
  })
})

function Harness({ inicial = null }: { inicial?: string | null }) {
  const [importacionId, setImportacionId] = useState<string | null>(inicial)
  return (
    <DebitosImportarPage
      importacionId={importacionId}
      onImportacionChange={setImportacionId}
      onIrAHistorial={vi.fn()}
    />
  )
}

function renderPage(importacionId: string | null) {
  return render(
    <DebitosImportarPage
      importacionId={importacionId}
      onImportacionChange={vi.fn()}
      onIrAHistorial={vi.fn()}
    />,
  )
}

async function subirArchivo(user: ReturnType<typeof userEvent.setup>, texto: string) {
  await user.upload(
    screen.getByLabelText('Archivo de resultados'),
    new File([texto], 'resultados.txt', { type: 'text/plain' }),
  )
}

describe('DebitosImportarPage', () => {
  it('carga la revisión por ID, pagina y filtra por defecto rechazados y errores', async () => {
    const user = userEvent.setup()
    renderPage('imp-1')

    expect(await screen.findByText('F-2026-01219')).toBeInTheDocument()
    await waitFor(() =>
      expect(vi.mocked(obtenerImportacionDebitos)).toHaveBeenCalledWith(
        'imp-1',
        { resultado: 'revision', buscar: '', pagina: 1, tamanio: 25 },
        expect.anything(),
      ),
    )
    const resumen = screen.getByRole('region', { name: 'Resumen de la importación' })
    expect(within(resumen).getByText('Procesados')).toBeInTheDocument()
    expect(within(resumen).getByText('438')).toBeInTheDocument()
    expect(within(resumen).getByText('Cobrados')).toBeInTheDocument()
    expect(within(resumen).getByText('401')).toBeInTheDocument()
    expect(within(resumen).getByText('Rechazados')).toBeInTheDocument()
    expect(within(resumen).getByText('31')).toBeInTheDocument()
    expect(within(resumen).getByText('Errores')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Errores · 0' }))
    await waitFor(() =>
      expect(vi.mocked(obtenerImportacionDebitos)).toHaveBeenLastCalledWith(
        'imp-1',
        expect.objectContaining({ resultado: 'errores', pagina: 1 }),
        expect.anything(),
      ),
    )

    await user.type(screen.getByPlaceholderText('Buscar factura o alumno'), 'Sofía')
    await waitFor(() =>
      expect(vi.mocked(obtenerImportacionDebitos)).toHaveBeenLastCalledWith(
        'imp-1',
        expect.objectContaining({ buscar: 'Sofía', pagina: 1 }),
        expect.anything(),
      ),
    )
    await waitFor(() => expect(screen.getByRole('link', { name: '2' })).toBeInTheDocument())
    await user.click(screen.getByRole('link', { name: '2' }))
    await waitFor(() =>
      expect(vi.mocked(obtenerImportacionDebitos)).toHaveBeenLastCalledWith(
        'imp-1',
        expect.objectContaining({ pagina: 2 }),
        expect.anything(),
      ),
    )
  })

  it('sube el archivo, muestra la vista previa y confirma solo con la revisión explícita', async () => {
    const user = userEvent.setup()
    vi.mocked(previsualizarRespuestaDebitos).mockResolvedValue(revision)
    render(<Harness />)

    await subirArchivo(user, 'respuesta')

    expect(await screen.findByText('Procesados')).toBeInTheDocument()
    await waitFor(() => expect(vi.mocked(previsualizarRespuestaDebitos)).toHaveBeenCalled())
    const confirmar = await screen.findByRole('button', {
      name: 'Confirmar y registrar 401 pagos',
    })
    expect(confirmar).toBeDisabled()

    await user.click(
      screen.getByRole('checkbox', {
        name: 'Revisé el resumen y el detalle de rechazados y errores.',
      }),
    )
    expect(confirmar).toBeEnabled()
    await user.click(confirmar)

    await waitFor(() => expect(vi.mocked(confirmarRespuestaDebitos)).toHaveBeenCalledWith('imp-1'))
    expect(await screen.findByText('Pagos registrados')).toBeInTheDocument()
    expect(screen.queryByText('Vista previa: todavía no se registró ningún pago')).toBeNull()
  })

  it('no habilita confirmar si hay errores, aunque existan cobros válidos', async () => {
    const user = userEvent.setup()
    vi.mocked(obtenerImportacionDebitos).mockResolvedValue(previewConError)
    renderPage('imp-1')

    expect(await screen.findByText('Factura no encontrada en el lote.')).toBeInTheDocument()
    await user.click(
      screen.getByRole('checkbox', {
        name: 'Revisé el resumen y el detalle de rechazados y errores.',
      }),
    )
    expect(screen.getByRole('button', { name: 'Confirmar y registrar 401 pagos' })).toBeDisabled()
    expect(screen.getByText(/1 error bloquea/)).toBeInTheDocument()
  })

  it('si el estado cambió muestra incidencias, no registra pagos y destilda la revisión', async () => {
    const user = userEvent.setup()
    vi.mocked(confirmarRespuestaDebitos).mockResolvedValue({
      ...revision,
      puede_confirmar: false,
      errores: ['La factura F-2026-01219 ya está pagada.'],
      items: [{ ...revision.items[0], estado: 'error', mensaje: 'La factura ya está pagada.' }],
      total: 1,
    })
    renderPage('imp-1')

    await screen.findByText('F-2026-01219')
    const revisionCheck = screen.getByRole('checkbox', {
      name: 'Revisé el resumen y el detalle de rechazados y errores.',
    })
    await user.click(revisionCheck)
    await user.click(screen.getByRole('button', { name: 'Confirmar y registrar 401 pagos' }))

    expect(await screen.findByText('No se registraron pagos')).toBeInTheDocument()
    expect(screen.getAllByText('La factura F-2026-01219 ya está pagada.').length).toBeGreaterThan(0)
    expect(revisionCheck).not.toBeChecked()
  })

  it('reemplazar el archivo invalida la vista previa anterior', async () => {
    const user = userEvent.setup()
    vi.mocked(previsualizarRespuestaDebitos)
      .mockResolvedValueOnce(revision)
      .mockResolvedValueOnce({
        ...revision,
        id: 'imp-2',
        archivo_hash: 'hash-2',
        resumen: {
          procesados: { cantidad: 10, importe: '1000000.00' },
          cobrados: { cantidad: 10, importe: '1000000.00' },
          rechazados: { cantidad: 0, importe: '0.00' },
          errores: { cantidad: 0, importe: '0.00' },
        },
      })
    render(<Harness />)

    await subirArchivo(user, 'primera')
    expect(await screen.findByText('438')).toBeInTheDocument()

    await subirArchivo(user, 'segunda')

    await waitFor(() => expect(vi.mocked(previsualizarRespuestaDebitos)).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByText('438')).not.toBeInTheDocument())
    expect(screen.getByText('Procesados')).toBeInTheDocument()
  })

  it('reimportar un resultado confirmado muestra el registro existente sin duplicar pagos', async () => {
    const user = userEvent.setup()
    vi.mocked(previsualizarRespuestaDebitos).mockResolvedValue({
      ...revision,
      estado: 'confirmada',
      puede_confirmar: false,
    })
    render(<Harness />)

    await subirArchivo(user, 'respuesta ya confirmada')

    expect(await screen.findByText('Esta importación ya fue confirmada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Confirmar y registrar/ })).not.toBeInTheDocument()
    expect(confirmarRespuestaDebitos).not.toHaveBeenCalled()
  })

  it('descarga todas las incidencias, no solo la página filtrada', async () => {
    const user = userEvent.setup()
    renderPage('imp-1')
    await screen.findByText('F-2026-01219')

    await user.click(screen.getByRole('button', { name: 'Descargar rechazados y errores (CSV)' }))

    await waitFor(() =>
      expect(vi.mocked(descargarIncidenciasDebitos)).toHaveBeenCalledWith('imp-1'),
    )
    expect(vi.mocked(descargarArchivoDebitos)).toHaveBeenCalledWith({
      nombre: 'incidencias.csv',
      contenido: 'csv',
    })
  })

  it('muestra el vacío inicial, el error con reintento y la carga', async () => {
    renderPage(null)
    expect(screen.getByText('Todavía no cargaste un archivo de resultados.')).toBeInTheDocument()

    vi.mocked(obtenerImportacionDebitos).mockImplementationOnce(() => new Promise(() => undefined))
    renderPage('imp-1')
    expect(screen.getByRole('status')).toHaveTextContent('Cargando importación…')
  })

  it('expone el error de la revisión y permite reintentar', async () => {
    vi.mocked(obtenerImportacionDebitos).mockRejectedValueOnce(new Error('Sin conexión.'))
    renderPage('imp-1')
    expect(await screen.findByText('Sin conexión.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeEnabled()
  })
})
