import { afterEach, describe, expect, it, vi } from 'vitest'
import { actualizarPlantilla } from '@/modules/workflows/services/actualizar-plantilla'
import { actualizarReglaWorkflow } from '@/modules/workflows/services/actualizar-regla-workflow'
import { crearPlantilla } from '@/modules/workflows/services/crear-plantilla'
import { crearReglaWorkflow } from '@/modules/workflows/services/crear-regla-workflow'
import { listarEjecucionesWorkflow } from '@/modules/workflows/services/listar-ejecuciones-workflow'
import { listarPlantillas } from '@/modules/workflows/services/listar-plantillas'
import { listarReglasWorkflow } from '@/modules/workflows/services/listar-reglas-workflow'
import { listarTiposAccion } from '@/modules/workflows/services/listar-tipos-accion'
import { listarTiposEvento } from '@/modules/workflows/services/listar-tipos-evento'
import { obtenerDestinatariosRegla } from '@/modules/workflows/services/obtener-destinatarios-regla'
import { reemplazarDestinatariosRegla } from '@/modules/workflows/services/reemplazar-destinatarios-regla'
import { reintentarEjecucionWorkflow } from '@/modules/workflows/services/reintentar-ejecucion-workflow'
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
      notificacion_template_id: null,
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

  it('lista ejecuciones con paginación y el estado solo si viene', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await listarEjecucionesWorkflow({ pagina: 2, tamanioPagina: 20 })
    await listarEjecucionesWorkflow({ estado: 'fallido', pagina: 1, tamanioPagina: 20 })

    expect(fetchMock.mock.calls[0][0]).toContain(
      '/workflows/ejecuciones?pagina=2&tamanio_pagina=20',
    )
    expect(fetchMock.mock.calls[0][0]).not.toContain('estado')
    expect(fetchMock.mock.calls[1][0]).toContain('estado=fallido')
  })

  it('reintenta una ejecución con POST sin body', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await reintentarEjecucionWorkflow('ejec-1')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/workflows/ejecuciones/ejec-1/reintentar')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBeUndefined()
  })

  it('lista las plantillas compatibles con el evento', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await listarPlantillas('evento-1')

    expect(fetchMock.mock.calls[0][0]).toContain('/workflows/plantillas?tipo_evento_id=evento-1')
  })

  it('crea una plantilla con POST y el payload en JSON', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())
    const payload = { nombre: 'Aviso', asunto: 'Hola {{monto}}', cuerpo: 'Debés {{monto}}' }

    await crearPlantilla(payload)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/workflows/plantillas')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(JSON.stringify(payload))
  })

  it('actualiza una plantilla con PATCH', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())
    const payload = { nombre: 'Aviso', asunto: 'Asunto', cuerpo: 'Cuerpo' }

    await actualizarPlantilla('plantilla-1', payload)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/workflows/plantillas/plantilla-1')
    expect(init?.method).toBe('PATCH')
    expect(init?.body).toBe(JSON.stringify(payload))
  })

  it('obtiene los destinatarios de una regla', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await obtenerDestinatariosRegla('regla-1')

    expect(fetchMock.mock.calls[0][0]).toContain('/workflows/reglas/regla-1/destinatarios')
  })

  it('reemplaza los destinatarios de una regla con PUT', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())
    const payload = { rol_ids: ['rol-1'], usuario_ids: [] }

    await reemplazarDestinatariosRegla('regla-1', payload)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/workflows/reglas/regla-1/destinatarios')
    expect(init?.method).toBe('PUT')
    expect(init?.body).toBe(JSON.stringify(payload))
  })
})
