import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useIndicadorCarga } from '@/modules/academico/hooks/use-indicador-carga'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useIndicadorCarga', () => {
  it('no aparece si la carga termina antes de la demora', () => {
    const { result, rerender } = renderHook(({ cargando }) => useIndicadorCarga(cargando), {
      initialProps: { cargando: true },
    })
    act(() => vi.advanceTimersByTime(150))
    rerender({ cargando: false })
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current).toBe(false)
  })

  it('aparece pasada la demora y se queda al menos el mínimo', () => {
    const { result, rerender } = renderHook(({ cargando }) => useIndicadorCarga(cargando), {
      initialProps: { cargando: true },
    })
    act(() => vi.advanceTimersByTime(200))
    expect(result.current).toBe(true)

    act(() => vi.advanceTimersByTime(100))
    rerender({ cargando: false })
    act(() => vi.advanceTimersByTime(100))
    expect(result.current).toBe(true)
    act(() => vi.advanceTimersByTime(100))
    expect(result.current).toBe(false)
  })
})
