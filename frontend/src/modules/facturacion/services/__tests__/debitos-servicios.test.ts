import { afterEach, describe, expect, it, vi } from 'vitest'
import { confirmarRespuestaDebitos } from '@/modules/facturacion/services/confirmar-respuesta-debitos'
import { crearLoteDebitos } from '@/modules/facturacion/services/crear-lote-debitos'
import { descargarIncidenciasDebitos } from '@/modules/facturacion/services/descargar-incidencias-debitos'
import { generarRespuestaDebitos } from '@/modules/facturacion/services/generar-respuesta-debitos'
import { liberarLoteDebitos } from '@/modules/facturacion/services/liberar-lote-debitos'
import { listarFacturasElegiblesDebitos } from '@/modules/facturacion/services/listar-facturas-elegibles-debitos'
import { listarLiberacionesDebitos } from '@/modules/facturacion/services/listar-liberaciones-debitos'
import { listarLotesDebitos } from '@/modules/facturacion/services/listar-lotes-debitos'
import { obtenerImportacionDebitos } from '@/modules/facturacion/services/obtener-importacion-debitos'
import { obtenerOpcionesDebitos } from '@/modules/facturacion/services/obtener-opciones-debitos'
import { previsualizarRespuestaDebitos } from '@/modules/facturacion/services/previsualizar-respuesta-debitos'
import { resumirSeleccionDebitos } from '@/modules/facturacion/services/resumir-seleccion-debitos'

const respuestaOk = () =>
  new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

const seleccionFiltrada = {
  modo: 'filtrados' as const,
  factura_ids: [],
  filtros: { periodo: '2026-10', medio: 'cbu' as const, estado: 'pendientes_sin_lote' as const },
  excluir_ids: [],
}

describe('servicios de débitos automáticos', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('consulta opciones y facturas elegibles con el alcance del servidor', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await obtenerOpcionesDebitos()
    await listarFacturasElegiblesDebitos({
      periodo: '2026-10',
      medio: 'tarjeta',
      estado: 'pendientes_sin_lote',
      buscar: 'García',
      pagina: 2,
      tamanio: 25,
    })

    expect(fetchMock.mock.calls[0][0]).toContain('/facturacion/cobranzas-simuladas/opciones')
    expect(fetchMock.mock.calls[1][0]).toContain(
      '/facturacion/cobranzas-simuladas/facturas-elegibles?periodo=2026-10&medio=tarjeta&estado=pendientes_sin_lote&buscar=Garc%C3%ADa&pagina=2&tamanio=25',
    )
  })

  it('resume una selección de página con sus IDs y una selección filtrada con el predicado', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())
    const pagina = {
      modo: 'pagina' as const,
      factura_ids: ['f-1', 'f-2'],
      filtros: { periodo: '2026-10', estado: 'pendientes_sin_lote' as const },
      excluir_ids: [],
    }

    await resumirSeleccionDebitos(pagina)
    await resumirSeleccionDebitos(seleccionFiltrada)

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/resumen-seleccion$/)
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({ seleccion: pagina })
    expect(fetchMock.mock.calls[1][1]?.method).toBe('POST')
    expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string)).toEqual({
      seleccion: seleccionFiltrada,
    })
  })

  it('crea el lote con la misma selección y período, sin confirmar pagos', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await crearLoteDebitos(seleccionFiltrada, '2026-10')

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/facturacion\/cobranzas-simuladas$/)
    expect(fetchMock.mock.calls[0][1]?.method).toBe('POST')
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      seleccion: seleccionFiltrada,
      periodo: '2026-10',
    })
  })

  it('previsualiza contenido y confirma por ID durable con revisión explícita', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await previsualizarRespuestaDebitos('contenido')
    await confirmarRespuestaDebitos('importacion-1')

    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      contenido: 'contenido',
    })
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/confirmar$/)
    expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string)).toEqual({
      importacion_id: 'importacion-1',
      revision_confirmada: true,
    })
  })

  it('lee la revisión paginada y descarga las incidencias completas', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await obtenerImportacionDebitos('importacion-1', {
      resultado: 'errores',
      buscar: 'Sofía',
      pagina: 2,
      tamanio: 25,
    })
    await descargarIncidenciasDebitos('importacion-1')

    expect(fetchMock.mock.calls[0][0]).toContain(
      '/facturacion/cobranzas-simuladas/importaciones/importacion-1?resultado=errores&buscar=Sof%C3%ADa&pagina=2&tamanio=25',
    )
    expect(fetchMock.mock.calls[1][0]).toContain(
      '/facturacion/cobranzas-simuladas/importaciones/importacion-1/incidencias',
    )
  })

  it('consulta el historial paginado y el registro de liberaciones', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await listarLotesDebitos({
      periodo: '2026-10',
      estado: 'exportado',
      buscar: 'LD-2026',
      pagina: 2,
      tamanio: 25,
    })
    await listarLiberacionesDebitos({ pagina: 3, tamanio: 25 })

    expect(fetchMock.mock.calls[0][0]).toContain(
      '/facturacion/cobranzas-simuladas?periodo=2026-10&estado=exportado&buscar=LD-2026&pagina=2&tamanio=25',
    )
    expect(fetchMock.mock.calls[1][0]).toContain(
      '/facturacion/cobranzas-simuladas/liberaciones?pagina=3&tamanio=25',
    )
  })

  it('genera una respuesta mixta con cantidad de rechazos y libera con motivo confirmado', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await generarRespuestaDebitos('lote-1', { rechazosCantidad: 3 })
    await liberarLoteDebitos('lote-1', {
      motivo: 'El banco no procesó el archivo',
      confirmacion_no_procesado: true,
    })

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/lote-1\/respuesta$/)
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      rechazar_referencias: [],
      rechazos_cantidad: 3,
    })
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/lote-1\/liberar$/)
    expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string)).toEqual({
      motivo: 'El banco no procesó el archivo',
      confirmacion_no_procesado: true,
    })
  })
})
