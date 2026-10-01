import { afterEach, describe, expect, it, vi } from 'vitest'
import { actualizarReglaWorkflow } from '@/modules/workflows/services/actualizar-regla-workflow'
import { crearReglaWorkflow } from '@/modules/workflows/services/crear-regla-workflow'
import { listarReglasWorkflow } from '@/modules/workflows/services/listar-reglas-workflow'
import { listarTiposAccion } from '@/modules/workflows/services/listar-tipos-accion'
import { listarTiposEvento } from '@/modules/workflows/services/listar-tipos-evento'
import { obtenerReglaWorkflow } from '@/modules/workflows/services/obtener-regla-workflow'

const respuestaOk = () =>
  new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

describe('servicios de workflows', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('consulta los catálogos de eventos y acciones', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await listarTiposEvento()
    await listarTiposAccion()

    expect(fetchMock.mock.calls[0][0]).toContain('/workflows/tipos-evento')
    expect(fetchMock.mock.calls[1][0]).toContain('/workflows/tipos-accion')
  })

  it('lista y obtiene reglas', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await listarReglasWorkflow()
    await obtenerReglaWorkflow('regla-1')

    expect(fetchMock.mock.calls[0][0]).toContain('/workflows/reglas')
    expect(fetchMock.mock.calls[1][0]).toContain('/workflows/reglas/regla-1')
  })

  it('crea una regla con POST y el payload en JSON', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())
    const payload = {
      nombre: 'Aviso de mora',
      tipo_evento_id: 'evento-1',
      condicion: {},
      tipo_accion: 'notificar' as const,
      accion_config: {},
      criticidad: 'media' as const,
      requiere_aprobacion_humana: false,
      activo: true,
    }

    await crearReglaWorkflow(payload)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/workflows/reglas')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(JSON.stringify(payload))
  })

  it('actualiza una regla con PATCH y solo los campos indicados', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await actualizarReglaWorkflow('regla-1', { activo: false })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/workflows/reglas/regla-1')
    expect(init?.method).toBe('PATCH')
    expect(init?.body).toBe(JSON.stringify({ activo: false }))
  })
})
