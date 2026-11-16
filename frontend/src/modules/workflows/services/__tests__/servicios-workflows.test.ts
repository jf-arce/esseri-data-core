import { afterEach, describe, expect, it, vi } from 'vitest'
import { listarEventosRecientes } from '@/modules/workflows/services/listar-eventos-recientes'
import { obtenerEstadisticasRegla } from '@/modules/workflows/services/obtener-estadisticas-regla'
import { obtenerResumenWorkflows } from '@/modules/workflows/services/obtener-resumen-workflows'
import { simularRegla } from '@/modules/workflows/services/simular-regla'
import { actualizarPlantilla } from '@/modules/workflows/services/actualizar-plantilla'
import { actualizarReglaWorkflow } from '@/modules/workflows/services/actualizar-regla-workflow'
import { crearPlantilla } from '@/modules/workflows/services/crear-plantilla'
import { cambiarEstadoTarea } from '@/modules/workflows/services/cambiar-estado-tarea'
import { crearReglaWorkflow } from '@/modules/workflows/services/crear-regla-workflow'
import { listarEjecucionesWorkflow } from '@/modules/workflows/services/listar-ejecuciones-workflow'
import { listarNotificaciones } from '@/modules/workflows/services/listar-notificaciones'
import { listarPlantillas } from '@/modules/workflows/services/listar-plantillas'
import { listarTareas } from '@/modules/workflows/services/listar-tareas'
import { listarReglasWorkflow } from '@/modules/workflows/services/listar-reglas-workflow'
import { listarTiposAccion } from '@/modules/workflows/services/listar-tipos-accion'
import { listarTiposEvento } from '@/modules/workflows/services/listar-tipos-evento'
import { aprobarEjecucionWorkflow } from '@/modules/workflows/services/aprobar-ejecucion-workflow'
import { rechazarEjecucionWorkflow } from '@/modules/workflows/services/rechazar-ejecucion-workflow'
import { reasignarTarea } from '@/modules/workflows/services/reasignar-tarea'
import { reintentarEjecucionWorkflow } from '@/modules/workflows/services/reintentar-ejecucion-workflow'
import { obtenerNotificacion } from '@/modules/workflows/services/obtener-notificacion'
import { obtenerTarea } from '@/modules/workflows/services/obtener-tarea'
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
      criticidad: 'media' as const,
      activo: true,
      nodos: [
        {
          id: 'n-1',
          tipo: 'accion' as const,
          padre_id: null,
          rama: null,
          condicion: null,
          tipo_accion: 'notificar' as const,
          accion_config: {},
          notificacion_template_id: null,
          requiere_aprobacion_humana: false,
          destinatarios: { rol_ids: [], usuario_ids: [] },
          posicion: { x: 0, y: 0 },
        },
      ],
      bloques_sueltos: [],
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

  it('lista notificaciones con paginación y los filtros solo si vienen', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await listarNotificaciones({ pagina: 2, tamanioPagina: 20 })
    await listarNotificaciones({
      estadoEnvio: 'fallido',
      destinatarioTipo: 'familia',
      pagina: 1,
      tamanioPagina: 20,
    })

    expect(fetchMock.mock.calls[0][0]).toContain(
      '/workflows/notificaciones?pagina=2&tamanio_pagina=20',
    )
    expect(fetchMock.mock.calls[0][0]).not.toContain('estado_envio')
    expect(fetchMock.mock.calls[0][0]).not.toContain('destinatario_tipo')
    expect(fetchMock.mock.calls[1][0]).toContain('estado_envio=fallido')
    expect(fetchMock.mock.calls[1][0]).toContain('destinatario_tipo=familia')
  })

  it('pide el detalle de una notificación por id', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await obtenerNotificacion('notif-1')

    expect(fetchMock.mock.calls[0][0]).toContain('/workflows/notificaciones/notif-1')
  })

  it('reintenta una ejecución con POST sin body', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await reintentarEjecucionWorkflow('ejec-1')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/workflows/ejecuciones/ejec-1/reintentar')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBeUndefined()
  })

  it('aprueba una ejecución con POST sin body', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await aprobarEjecucionWorkflow('ejec-1')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/workflows/ejecuciones/ejec-1/aprobar')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBeUndefined()
  })

  it('rechaza una ejecución con POST y el motivo en el body', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await rechazarEjecucionWorkflow('ejec-1', 'Ya se resolvió por otro medio')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/workflows/ejecuciones/ejec-1/rechazar')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ motivo: 'Ya se resolvió por otro medio' })
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

  it('prueba un borrador con POST a /reglas/simular', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())
    const payload = { tipo_evento_id: 'e-1', event_log_id: 'ev-1', nodos: [] }

    await simularRegla(payload)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/workflows/reglas/simular')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(JSON.stringify(payload))
  })

  it('pide los eventos recientes del tipo de evento', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await listarEventosRecientes('e-1')

    expect(fetchMock.mock.calls[0][0]).toContain('/workflows/eventos-recientes?tipo_evento_id=e-1')
  })

  it('pide las estadísticas de una regla y el resumen del módulo con los días', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await obtenerEstadisticasRegla('regla-1', 7)
    await obtenerResumenWorkflows(30)

    expect(fetchMock.mock.calls[0][0]).toContain('/workflows/reglas/regla-1/estadisticas?dias=7')
    expect(fetchMock.mock.calls[1][0]).toContain('/workflows/resumen?dias=30')
  })

  it('filtra las ejecuciones por regla y por nodo', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await listarEjecucionesWorkflow({ pagina: 1, tamanioPagina: 20, reglaId: 'r-1', nodoId: 'n-1' })

    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('workflow_rule_id=r-1')
    expect(url).toContain('workflow_nodo_id=n-1')
  })

  it('lista las tareas con sus filtros y pide solo las propias cuando se indica', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await listarTareas({ pagina: 2, tamanioPagina: 20, soloMias: false })
    await listarTareas({
      estado: 'escalada',
      prioridad: 'alta',
      soloMias: true,
      pagina: 1,
      tamanioPagina: 20,
    })

    const sinFiltros = String(fetchMock.mock.calls[0][0])
    expect(sinFiltros).toContain('/workflows/tareas?pagina=2&tamanio_pagina=20')
    expect(sinFiltros).not.toContain('solo_mias')
    const conFiltros = String(fetchMock.mock.calls[1][0])
    expect(conFiltros).toContain('estado=escalada')
    expect(conFiltros).toContain('prioridad=alta')
    expect(conFiltros).toContain('solo_mias=true')
  })

  it('filtra las tareas por responsable con usuario_id', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await listarTareas({ usuarioId: 'u-2', soloMias: false, pagina: 1, tamanioPagina: 20 })

    expect(String(fetchMock.mock.calls[0][0])).toContain('usuario_id=u-2')
  })

  it('reasigna una tarea con PATCH y el usuario en el body', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await reasignarTarea('t-1', 'u-3')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/workflows/tareas/t-1/asignado')
    expect(init?.method).toBe('PATCH')
    expect(init?.body).toBe(JSON.stringify({ usuario_id: 'u-3' }))
  })

  it('obtiene el detalle de una tarea y cambia su estado', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await obtenerTarea('t-1')
    await cambiarEstadoTarea('t-1', 'completada')

    expect(fetchMock.mock.calls[0][0]).toContain('/workflows/tareas/t-1')
    expect(fetchMock.mock.calls[1][0]).toContain('/workflows/tareas/t-1/estado')
    const init = fetchMock.mock.calls[1][1]
    expect(init?.method).toBe('PATCH')
    expect(init?.body).toBe(JSON.stringify({ estado: 'completada' }))
  })
})
