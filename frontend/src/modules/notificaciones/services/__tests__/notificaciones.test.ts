import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { listarNotificaciones } from '@/modules/notificaciones/services/listar-notificaciones'
import { marcarNotificacionLeida } from '@/modules/notificaciones/services/marcar-notificacion-leida'
import { marcarTodasNotificacionesLeidas } from '@/modules/notificaciones/services/marcar-todas-notificaciones-leidas'
import { obtenerResumenNotificaciones } from '@/modules/notificaciones/services/obtener-resumen-notificaciones'

vi.mock('@/api/client', () => ({ apiClient: vi.fn() }))

const mockedApiClient = vi.mocked(apiClient)

beforeEach(() => {
  vi.clearAllMocks()
  mockedApiClient.mockResolvedValue({} as never)
})

describe('servicios de notificaciones internas', () => {
  it('lista con el filtro, el límite y el cursor del contrato', async () => {
    const controller = new AbortController()

    await listarNotificaciones({
      noLeidas: true,
      limite: 20,
      cursor: 'cursor-1',
      signal: controller.signal,
    })
    await listarNotificaciones({ noLeidas: false })

    expect(mockedApiClient).toHaveBeenNthCalledWith(
      1,
      '/notificaciones?no_leidas=true&limite=20&cursor=cursor-1',
      { signal: controller.signal },
    )
    expect(mockedApiClient).toHaveBeenNthCalledWith(2, '/notificaciones?no_leidas=false&limite=20')
  })

  it('consulta el resumen y permite abortarlo', async () => {
    const controller = new AbortController()

    await obtenerResumenNotificaciones(controller.signal)
    await obtenerResumenNotificaciones()

    expect(mockedApiClient).toHaveBeenNthCalledWith(1, '/notificaciones/resumen', {
      signal: controller.signal,
    })
    expect(mockedApiClient).toHaveBeenNthCalledWith(2, '/notificaciones/resumen')
  })

  it('marca una notificación y todas las notificaciones con los verbos acordados', async () => {
    await marcarNotificacionLeida('notificacion-1')
    await marcarTodasNotificacionesLeidas()

    expect(mockedApiClient).toHaveBeenNthCalledWith(1, '/notificaciones/notificacion-1/lectura', {
      method: 'PATCH',
    })
    expect(mockedApiClient).toHaveBeenNthCalledWith(2, '/notificaciones/lecturas', {
      method: 'POST',
    })
  })
})
