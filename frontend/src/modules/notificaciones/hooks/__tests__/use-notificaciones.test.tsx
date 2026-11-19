import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listarNotificaciones } from '@/modules/notificaciones/services/listar-notificaciones'
import { marcarNotificacionLeida } from '@/modules/notificaciones/services/marcar-notificacion-leida'
import { marcarTodasNotificacionesLeidas } from '@/modules/notificaciones/services/marcar-todas-notificaciones-leidas'
import { obtenerResumenNotificaciones } from '@/modules/notificaciones/services/obtener-resumen-notificaciones'
import { useNotificaciones } from '@/modules/notificaciones/hooks/use-notificaciones'
import type { ListadoNotificaciones, NotificacionInterna } from '@/modules/notificaciones/types'

vi.mock('@/modules/notificaciones/services/listar-notificaciones')
vi.mock('@/modules/notificaciones/services/obtener-resumen-notificaciones')
vi.mock('@/modules/notificaciones/services/marcar-notificacion-leida')
vi.mock('@/modules/notificaciones/services/marcar-todas-notificaciones-leidas')

const mockedListar = vi.mocked(listarNotificaciones)
const mockedResumen = vi.mocked(obtenerResumenNotificaciones)
const mockedMarcarLeida = vi.mocked(marcarNotificacionLeida)
const mockedMarcarTodas = vi.mocked(marcarTodasNotificacionesLeidas)

function crearNotificacion(overrides: Partial<NotificacionInterna> = {}): NotificacionInterna {
  return {
    id: 'notificacion-1',
    tipo: 'academico.inasistencia_registrada',
    titulo: 'Inasistencia registrada',
    mensaje: 'Se registró una ausencia de Juan el 17/11.',
    created_at: '2026-11-17T12:00:00Z',
    leida_at: null,
    destino: { tipo: 'asistencia', id: 'asistencia-1', alumno_id: 'alumno-1' },
    ...overrides,
  }
}

function crearListado(overrides: Partial<ListadoNotificaciones> = {}): ListadoNotificaciones {
  return {
    items: [],
    siguiente_cursor: null,
    total_no_leidas: 0,
    ...overrides,
  }
}

function renderNotificaciones(usuarioId = 'usuario-1', rolActivo = 'familia') {
  return renderHook(
    ({ usuario, rol }: { usuario: string; rol: string }) =>
      useNotificaciones({ habilitado: true, usuarioId: usuario, rolActivo: rol }),
    { initialProps: { usuario: usuarioId, rol: rolActivo } },
  )
}

let visibilidad: DocumentVisibilityState = 'visible'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  visibilidad = 'visible'
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibilidad,
  })
  mockedResumen.mockResolvedValue({ total_no_leidas: 0 })
  mockedListar.mockResolvedValue(crearListado())
  mockedMarcarLeida.mockResolvedValue({
    id: 'notificacion-1',
    leida_at: '2026-11-17T12:01:00Z',
  })
  mockedMarcarTodas.mockResolvedValue({ marcadas: 0 })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useNotificaciones', () => {
  it('no solapa el sondeo del resumen mientras hay una consulta en vuelo', async () => {
    let resolver!: (valor: { total_no_leidas: number }) => void
    mockedResumen.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolver = resolve
        }),
    )

    renderNotificaciones()

    await waitFor(() => expect(mockedResumen).toHaveBeenCalledTimes(1))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(mockedResumen).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolver({ total_no_leidas: 4 })
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(mockedResumen).toHaveBeenCalledTimes(2)
  })

  it('sondea solo con la pestaña visible y refresca al volver a ella y al enfocar', async () => {
    visibilidad = 'hidden'
    renderNotificaciones()

    await waitFor(() => expect(mockedResumen).toHaveBeenCalledTimes(1))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(mockedResumen).toHaveBeenCalledTimes(1)

    visibilidad = 'visible'
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(mockedResumen).toHaveBeenCalledTimes(2))

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    await waitFor(() => expect(mockedResumen).toHaveBeenCalledTimes(3))
  })

  it('descarta el resumen de la identidad anterior al cambiar de cuenta o de rol', async () => {
    let resolverViejo!: (valor: { total_no_leidas: number }) => void
    let signalViejo: AbortSignal | undefined
    mockedResumen.mockImplementationOnce(
      (signal) =>
        new Promise((resolve) => {
          signalViejo = signal
          resolverViejo = resolve
        }),
    )

    const { result, rerender } = renderNotificaciones('usuario-1', 'familia')
    await waitFor(() => expect(mockedResumen).toHaveBeenCalledTimes(1))

    mockedResumen.mockResolvedValueOnce({ total_no_leidas: 2 })
    rerender({ usuario: 'usuario-2', rol: 'familia' })

    expect(signalViejo?.aborted).toBe(true)
    expect(result.current.totalNoLeidas).toBeNull()
    await waitFor(() => expect(mockedResumen).toHaveBeenCalledTimes(2))

    await act(async () => {
      resolverViejo({ total_no_leidas: 7 })
    })
    expect(result.current.totalNoLeidas).toBe(2)

    rerender({ usuario: 'usuario-2', rol: 'administracion' })
    expect(result.current.totalNoLeidas).toBeNull()
  })

  it('aborta la lista en vuelo y no muestra sus datos al cambiar de identidad', async () => {
    let resolverLista!: (valor: ListadoNotificaciones) => void
    mockedListar.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolverLista = resolve
        }),
    )

    const { result, rerender } = renderNotificaciones('usuario-1', 'familia')
    await waitFor(() => expect(result.current.totalNoLeidas).toBe(0))

    act(() => result.current.setAbierto(true))
    await waitFor(() => expect(mockedListar).toHaveBeenCalledTimes(1))
    const signal = mockedListar.mock.calls[0][0].signal
    expect(signal).toBeDefined()

    rerender({ usuario: 'usuario-2', rol: 'familia' })

    expect(signal?.aborted).toBe(true)
    expect(result.current.items).toEqual([])

    await act(async () => {
      resolverLista(crearListado({ items: [crearNotificacion()], total_no_leidas: 1 }))
    })
    expect(result.current.items).toEqual([])
  })

  it('no deja que un resumen viejo pise el contador después de marcar una lectura', async () => {
    mockedResumen.mockResolvedValue({ total_no_leidas: 2 })
    mockedListar.mockResolvedValue(
      crearListado({
        items: [crearNotificacion()],
        total_no_leidas: 2,
      }),
    )

    const { result } = renderNotificaciones()
    await waitFor(() => expect(result.current.totalNoLeidas).toBe(2))

    act(() => result.current.setAbierto(true))
    await waitFor(() => expect(result.current.items).toHaveLength(1))

    let resolverResumenViejo!: (valor: { total_no_leidas: number }) => void
    mockedResumen.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolverResumenViejo = resolve
        }),
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(mockedResumen).toHaveBeenCalledTimes(3)

    await act(async () => {
      await result.current.marcarLeida('notificacion-1')
    })
    expect(result.current.totalNoLeidas).toBe(1)

    await act(async () => {
      resolverResumenViejo({ total_no_leidas: 2 })
    })
    expect(result.current.totalNoLeidas).toBe(1)
  })

  it('descarta un resumen que empezó mientras la lectura estaba en curso', async () => {
    mockedResumen.mockResolvedValue({ total_no_leidas: 2 })
    mockedListar.mockResolvedValue(
      crearListado({
        items: [crearNotificacion()],
        total_no_leidas: 2,
      }),
    )
    let resolverLectura!: (valor: { id: string; leida_at: string }) => void
    mockedMarcarLeida.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolverLectura = resolve
        }),
    )

    const { result } = renderNotificaciones()
    await waitFor(() => expect(result.current.totalNoLeidas).toBe(2))

    act(() => result.current.setAbierto(true))
    await waitFor(() => expect(result.current.items).toHaveLength(1))

    let promesaLectura!: Promise<boolean>
    await act(async () => {
      promesaLectura = result.current.marcarLeida('notificacion-1')
    })
    expect(result.current.totalNoLeidas).toBe(1)

    let resolverResumen!: (valor: { total_no_leidas: number }) => void
    mockedResumen.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolverResumen = resolve
        }),
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(mockedResumen).toHaveBeenCalledTimes(3)

    await act(async () => {
      resolverLectura({ id: 'notificacion-1', leida_at: '2026-11-17T12:01:00Z' })
      await promesaLectura
    })
    await act(async () => {
      resolverResumen({ total_no_leidas: 2 })
    })

    expect(result.current.totalNoLeidas).toBe(1)
  })

  it('no revierte el estado de un marcar todas posterior cuando falla una lectura anterior', async () => {
    mockedResumen.mockResolvedValue({ total_no_leidas: 2 })
    mockedListar.mockResolvedValue(
      crearListado({
        items: [crearNotificacion({ id: 'n-1' }), crearNotificacion({ id: 'n-2' })],
        total_no_leidas: 2,
      }),
    )
    let rechazarLectura!: (error: unknown) => void
    mockedMarcarLeida.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rechazarLectura = reject
        }),
    )
    mockedMarcarTodas.mockResolvedValue({ marcadas: 2 })

    const { result } = renderNotificaciones()
    await waitFor(() => expect(result.current.totalNoLeidas).toBe(2))

    act(() => result.current.setAbierto(true))
    await waitFor(() => expect(result.current.items).toHaveLength(2))

    let promesaLectura!: Promise<boolean>
    await act(async () => {
      promesaLectura = result.current.marcarLeida('n-1')
    })
    expect(result.current.totalNoLeidas).toBe(1)

    await act(async () => {
      await result.current.marcarTodas()
    })
    expect(result.current.totalNoLeidas).toBe(0)
    expect(result.current.items.every((item) => item.leida_at !== null)).toBe(true)

    await act(async () => {
      rechazarLectura(new Error('network'))
      await promesaLectura
    })

    expect(result.current.totalNoLeidas).toBe(0)
    expect(result.current.items).toHaveLength(2)
    expect(result.current.items.every((item) => item.leida_at !== null)).toBe(true)
    expect(result.current.errorAccion).toBe('No se pudo marcar la notificación como leída.')
  })

  it('marca todas y deja vacío el filtro de no leídas', async () => {
    mockedResumen.mockResolvedValue({ total_no_leidas: 2 })
    mockedListar.mockResolvedValue(
      crearListado({
        items: [crearNotificacion({ id: 'n-1' }), crearNotificacion({ id: 'n-2' })],
        total_no_leidas: 2,
      }),
    )
    mockedMarcarTodas.mockResolvedValue({ marcadas: 2 })

    const { result } = renderNotificaciones()
    await waitFor(() => expect(result.current.totalNoLeidas).toBe(2))

    act(() => result.current.setAbierto(true))
    await waitFor(() => expect(result.current.items).toHaveLength(2))

    act(() => result.current.setFiltro('no_leidas'))
    await waitFor(() =>
      expect(mockedListar).toHaveBeenLastCalledWith(expect.objectContaining({ noLeidas: true })),
    )

    await act(async () => {
      await result.current.marcarTodas()
    })

    expect(mockedMarcarTodas).toHaveBeenCalledTimes(1)
    expect(result.current.totalNoLeidas).toBe(0)
    expect(result.current.items).toEqual([])
  })

  it('agrega la página siguiente con el cursor y sin duplicar elementos', async () => {
    mockedListar
      .mockResolvedValueOnce(
        crearListado({ items: [crearNotificacion({ id: 'n-1' })], siguiente_cursor: 'cursor-1' }),
      )
      .mockResolvedValueOnce(
        crearListado({
          items: [crearNotificacion({ id: 'n-1' }), crearNotificacion({ id: 'n-2' })],
          siguiente_cursor: null,
        }),
      )

    const { result } = renderNotificaciones()
    act(() => result.current.setAbierto(true))
    await waitFor(() => expect(result.current.items).toHaveLength(1))

    await act(async () => {
      await result.current.cargarMas()
    })

    expect(mockedListar).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'cursor-1', noLeidas: false }),
    )
    expect(result.current.items.map((item) => item.id)).toEqual(['n-1', 'n-2'])
    expect(result.current.siguienteCursor).toBeNull()
  })

  it('no vacía el listado al volver a tocar el filtro activo', async () => {
    mockedListar.mockResolvedValue(
      crearListado({ items: [crearNotificacion({ id: 'n-1' })], total_no_leidas: 1 }),
    )

    const { result } = renderNotificaciones()
    act(() => result.current.setAbierto(true))
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    const llamadas = mockedListar.mock.calls.length

    act(() => result.current.setFiltro('todas'))

    expect(result.current.items.map((item) => item.id)).toEqual(['n-1'])
    expect(result.current.estado).toBe('listo')
    expect(mockedListar).toHaveBeenCalledTimes(llamadas)
  })

  it('descarta la página siguiente si el filtro cambia mientras está en vuelo', async () => {
    let resolverPaginaVieja!: (valor: ListadoNotificaciones) => void
    mockedListar
      .mockResolvedValueOnce(
        crearListado({ items: [crearNotificacion({ id: 'n-1' })], siguiente_cursor: 'cursor-1' }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolverPaginaVieja = resolve
          }),
      )
      .mockResolvedValueOnce(
        crearListado({ items: [crearNotificacion({ id: 'n-2' })], siguiente_cursor: null }),
      )

    const { result } = renderNotificaciones()
    act(() => result.current.setAbierto(true))
    await waitFor(() => expect(result.current.items).toHaveLength(1))

    let promesaPagina!: Promise<void>
    await act(async () => {
      promesaPagina = result.current.cargarMas()
    })
    expect(mockedListar).toHaveBeenCalledTimes(2)

    act(() => result.current.setFiltro('no_leidas'))
    await waitFor(() =>
      expect(mockedListar).toHaveBeenLastCalledWith(expect.objectContaining({ noLeidas: true })),
    )
    await waitFor(() => expect(result.current.items.map((item) => item.id)).toEqual(['n-2']))

    await act(async () => {
      resolverPaginaVieja(
        crearListado({
          items: [crearNotificacion({ id: 'n-1' }), crearNotificacion({ id: 'vieja' })],
          siguiente_cursor: 'cursor-viejo',
        }),
      )
      await promesaPagina
    })

    expect(result.current.items.map((item) => item.id)).toEqual(['n-2'])
    expect(result.current.siguienteCursor).toBeNull()
  })
})
