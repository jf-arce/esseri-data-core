import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useActividadWorkflows } from '@/modules/workflows/hooks/use-actividad-workflows'
import { listarEjecucionesWorkflow } from '@/modules/workflows/services/listar-ejecuciones-workflow'
import type { EjecucionWorkflow } from '@/modules/workflows/types'

vi.mock('@/modules/workflows/services/listar-ejecuciones-workflow')

const mockedListar = vi.mocked(listarEjecucionesWorkflow)

function ejecucion(id: string): EjecucionWorkflow {
  return { id } as EjecucionWorkflow
}

function listado(...ids: string[]) {
  return {
    items: ids.map(ejecucion),
    total: ids.length,
    pagina: 1,
    tamanio_pagina: 15,
    total_paginas: 1,
  }
}

function ocultarPestania(oculta: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, value: oculta })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useActividadWorkflows', () => {
  it('carga al montar y vuelve a pedir en cada intervalo', async () => {
    mockedListar.mockResolvedValue(listado('a'))

    const { result } = renderHook(() => useActividadWorkflows(30_000))
    await act(async () => {})

    expect(mockedListar).toHaveBeenCalledTimes(1)
    expect(result.current.ejecuciones.map((e) => e.id)).toEqual(['a'])
    expect(result.current.actualizadoEn).toBeInstanceOf(Date)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(mockedListar).toHaveBeenCalledTimes(2)
  })

  it('la primera carga no anima y lo que llega después figura como nuevo', async () => {
    mockedListar.mockResolvedValueOnce(listado('a')).mockResolvedValueOnce(listado('b', 'a'))

    const { result } = renderHook(() => useActividadWorkflows(30_000))
    await act(async () => {})
    expect([...result.current.nuevas]).toEqual([])

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })

    expect([...result.current.nuevas]).toEqual(['b'])
  })

  it('con la pestaña oculta pausa el polling y al volver refresca de inmediato', async () => {
    mockedListar.mockResolvedValue(listado('a'))
    renderHook(() => useActividadWorkflows(30_000))
    await act(async () => {})
    expect(mockedListar).toHaveBeenCalledTimes(1)

    act(() => ocultarPestania(true))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000)
    })
    expect(mockedListar).toHaveBeenCalledTimes(1)

    await act(async () => {
      ocultarPestania(false)
    })
    expect(mockedListar).toHaveBeenCalledTimes(2)
  })

  it('si falla informa el error y conserva lo que ya mostraba', async () => {
    mockedListar.mockResolvedValueOnce(listado('a')).mockRejectedValueOnce(new Error('caído'))

    const { result } = renderHook(() => useActividadWorkflows(30_000))
    await act(async () => {})
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })

    expect(result.current.error).toBe('No se pudo actualizar la actividad.')
    expect(result.current.ejecuciones.map((e) => e.id)).toEqual(['a'])
  })

  it('manda el estado al backend y al cambiarlo no anima lo que llega', async () => {
    mockedListar.mockResolvedValue(listado('a'))
    const { result, rerender } = renderHook(
      ({ estado }: { estado?: 'fallido' }) => useActividadWorkflows(30_000, estado),
      { initialProps: {} },
    )
    await act(async () => {})

    mockedListar.mockResolvedValue(listado('b'))
    rerender({ estado: 'fallido' })
    await act(async () => {})

    expect(mockedListar).toHaveBeenLastCalledWith(
      expect.objectContaining({ estado: 'fallido' }),
      expect.anything(),
    )
    expect(result.current.ejecuciones.map((e) => e.id)).toEqual(['b'])
    expect([...result.current.nuevas]).toEqual([])
  })

  it('al desmontar deja de pedir', async () => {
    mockedListar.mockResolvedValue(listado('a'))
    const { unmount } = renderHook(() => useActividadWorkflows(30_000))
    await act(async () => {})

    unmount()
    await vi.advanceTimersByTimeAsync(90_000)

    expect(mockedListar).toHaveBeenCalledTimes(1)
  })
})
