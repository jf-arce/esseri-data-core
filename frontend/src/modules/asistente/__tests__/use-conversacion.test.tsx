import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { EventoSse } from '../types'

const enviarMensaje = vi.fn()
const crearConversacion = vi.fn()
const listarMensajes = vi.fn()

vi.mock('../services/enviar-mensaje', () => ({
  enviarMensaje: (...args: unknown[]) => enviarMensaje(...args),
}))
vi.mock('../services/conversaciones', () => ({
  crearConversacion: () => crearConversacion(),
  listarMensajes: (...args: unknown[]) => listarMensajes(...args),
}))

import { useConversacion } from '../hooks/use-conversacion'

const opciones = { ruta: '/panel', cicloLectivo: '2026', alNavegar: vi.fn() }

beforeEach(() => {
  vi.clearAllMocks()
  crearConversacion.mockResolvedValue({ id: 'c1' })
})

it('arma el mensaje del asistente a partir de los eventos', async () => {
  enviarMensaje.mockImplementation(
    async (
      _id: string,
      _pedido: unknown,
      _signal: AbortSignal,
      alEvento: (e: EventoSse) => void,
    ) => {
      alEvento({ evento: 'herramienta', datos: { solicitud_id: 's', nombre: 'ficha_alumno' } })
      alEvento({
        evento: 'tarjeta',
        datos: {
          solicitud_id: 's',
          bloque: { tipo: 'tarjeta', entidad: 'alumno', alias: '[ALUMNO:1]' },
        },
      })
      alEvento({ evento: 'texto', datos: { solicitud_id: 's', texto: 'Listo.' } })
      alEvento({ evento: 'fin', datos: { solicitud_id: 's', mensaje_id: 'm' } })
    },
  )
  const { result } = renderHook(() => useConversacion(opciones))

  await act(async () => {
    await result.current.enviar('hola', [])
  })

  const [usuario, asistente] = result.current.mensajes
  expect(usuario).toMatchObject({ autor: 'usuario', contenido: 'hola' })
  expect(asistente).toMatchObject({ autor: 'asistente', contenido: 'Listo.', estado: 'completo' })
  expect(asistente.bloques).toHaveLength(1)
  expect(enviarMensaje.mock.calls[0][1]).toMatchObject({
    contenido: 'hola',
    ruta: '/panel',
    ciclo_lectivo: '2026',
  })
})

it('al desmontarse corta el stream en curso', async () => {
  let senal: AbortSignal | undefined
  enviarMensaje.mockImplementation(
    (_id: string, _pedido: unknown, signal: AbortSignal) =>
      new Promise<void>((_resolver, rechazar) => {
        senal = signal
        signal.addEventListener('abort', () => rechazar(new DOMException('abortado', 'AbortError')))
      }),
  )
  const { result, unmount } = renderHook(() => useConversacion(opciones))

  act(() => {
    void result.current.enviar('hola', [])
  })
  await waitFor(() => expect(senal).toBeDefined())
  unmount()

  expect(senal?.aborted).toBe(true)
})

it('nueva conversación descarta mensajes y corta el stream', async () => {
  let senal: AbortSignal | undefined
  enviarMensaje.mockImplementation(
    (_id: string, _pedido: unknown, signal: AbortSignal) =>
      new Promise<void>((_resolver, rechazar) => {
        senal = signal
        signal.addEventListener('abort', () => rechazar(new DOMException('abortado', 'AbortError')))
      }),
  )
  const { result } = renderHook(() => useConversacion(opciones))
  act(() => {
    void result.current.enviar('hola', [])
  })
  await waitFor(() => expect(senal).toBeDefined())

  act(() => result.current.nueva())

  expect(senal?.aborted).toBe(true)
  expect(result.current.mensajes).toEqual([])
  expect(result.current.conversacionId).toBeNull()
})

it('muestra un mensaje claro cuando se llegó a la cuota', async () => {
  const { ApiError } = await import('@/api/client')
  enviarMensaje.mockRejectedValue(new ApiError(429, 'cuota'))
  const { result } = renderHook(() => useConversacion(opciones))

  await act(async () => {
    await result.current.enviar('hola', [])
  })

  expect(result.current.mensajes[1]).toMatchObject({
    estado: 'error',
    error: 'Llegaste al máximo de mensajes de hoy.',
  })
})

it('al abrir una conversación carga sus mensajes del servidor', async () => {
  listarMensajes.mockResolvedValue({
    items: [
      {
        id: 'm1',
        orden: 1,
        autor: 'usuario',
        contenido: 'hola',
        tarjetas: null,
        estado: 'completo',
        creado_en: '',
      },
    ],
    total: 1,
    pagina: 1,
    tamanio: 200,
  })
  const { result } = renderHook(() => useConversacion(opciones))

  await act(async () => {
    await result.current.abrir('c9')
  })

  expect(result.current.conversacionId).toBe('c9')
  expect(result.current.mensajes).toHaveLength(1)
})

it('reintentar vuelve a mandar la última pregunta y descarta el intento fallido', async () => {
  const { ApiError } = await import('@/api/client')
  enviarMensaje.mockRejectedValueOnce(new ApiError(503, null))
  enviarMensaje.mockImplementationOnce(
    async (
      _id: string,
      _pedido: unknown,
      _signal: AbortSignal,
      alEvento: (e: EventoSse) => void,
    ) => {
      alEvento({ evento: 'texto', datos: { solicitud_id: 's', texto: 'Ahora sí.' } })
      alEvento({ evento: 'fin', datos: { solicitud_id: 's', mensaje_id: 'm' } })
    },
  )
  const { result } = renderHook(() => useConversacion(opciones))
  await act(async () => {
    await result.current.enviar('hola', [])
  })
  expect(result.current.mensajes[1].estado).toBe('error')

  await act(async () => {
    result.current.reintentar()
  })

  expect(result.current.mensajes).toHaveLength(2)
  expect(result.current.mensajes[1]).toMatchObject({ contenido: 'Ahora sí.', estado: 'completo' })
  expect(enviarMensaje.mock.calls[1][1]).toMatchObject({ contenido: 'hola' })
})
