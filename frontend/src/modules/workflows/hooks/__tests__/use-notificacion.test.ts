import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { useNotificacion } from '@/modules/workflows/hooks/use-notificacion'
import { obtenerNotificacion } from '@/modules/workflows/services/obtener-notificacion'
import type { NotificacionEnviadaDetalle } from '@/modules/workflows/types'

vi.mock('@/modules/workflows/services/obtener-notificacion')

const mockedObtener = vi.mocked(obtenerNotificacion)

function detalle(id: string, cuerpo: string): NotificacionEnviadaDetalle {
  return {
    id,
    destinatario_tipo: 'usuario',
    canal: 'email',
    destinatario_snapshot: 'a@esseri.edu.ar',
    asunto_snapshot: 'Asunto',
    estado_envio: 'enviado',
    sent_at: '2026-09-01T10:00:00',
    familia_id: null,
    usuario_id: 'u-1',
    workflow_execution_id: 'ej-1',
    intento: 1,
    ejecucion_started_at: '2026-09-01T10:00:00',
    workflow_rule_id: 'r-1',
    workflow_rule_nombre: 'Aviso de mora',
    cuerpo_snapshot: cuerpo,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useNotificacion', () => {
  it('no pide nada sin id', () => {
    const { result } = renderHook(() => useNotificacion(null))

    expect(mockedObtener).not.toHaveBeenCalled()
    expect(result.current).toEqual({ datos: null, error: null, cargando: false })
  })

  it('carga el detalle', async () => {
    mockedObtener.mockResolvedValue(detalle('n-1', 'Debe 1500'))

    const { result } = renderHook(() => useNotificacion('n-1'))
    expect(result.current.cargando).toBe(true)

    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.datos?.cuerpo_snapshot).toBe('Debe 1500')
  })

  it('informa el error del backend', async () => {
    mockedObtener.mockRejectedValue(new ApiError(404, 'La notificación indicada no existe.'))

    const { result } = renderHook(() => useNotificacion('n-1'))

    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.datos).toBeNull()
    expect(result.current.error).toBe('La notificación indicada no existe.')
  })

  it('al pasar de A a B nunca muestra el cuerpo de A y aborta su pedido', async () => {
    let resolverA: (valor: NotificacionEnviadaDetalle) => void = () => {}
    let senialA: AbortSignal | undefined
    mockedObtener.mockImplementation((id, signal) => {
      if (id === 'a') {
        senialA = signal
        return new Promise((resolver) => {
          resolverA = resolver
        })
      }
      return Promise.resolve(detalle('b', 'Cuerpo de B'))
    })

    const { result, rerender } = renderHook((id) => useNotificacion(id), { initialProps: 'a' })
    rerender('b')

    await waitFor(() => expect(result.current.datos?.cuerpo_snapshot).toBe('Cuerpo de B'))
    expect(senialA?.aborted).toBe(true)

    resolverA(detalle('a', 'Cuerpo de A'))
    await Promise.resolve()
    expect(result.current.datos?.cuerpo_snapshot).toBe('Cuerpo de B')
  })
})
