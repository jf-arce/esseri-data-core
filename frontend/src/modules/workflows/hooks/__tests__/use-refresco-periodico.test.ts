import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRefrescoPeriodico } from '@/modules/workflows/hooks/use-refresco-periodico'

function ocultarPestania(oculta: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, value: oculta })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useRefrescoPeriodico', () => {
  it('no llama al montar y llama en cada intervalo', async () => {
    const refrescar = vi.fn()
    renderHook(() => useRefrescoPeriodico(refrescar, 30_000))
    expect(refrescar).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(60_000)

    expect(refrescar).toHaveBeenCalledTimes(2)
  })

  it('con la pestaña oculta se pausa y al volver refresca de inmediato', async () => {
    const refrescar = vi.fn()
    renderHook(() => useRefrescoPeriodico(refrescar, 30_000))

    act(() => ocultarPestania(true))
    await vi.advanceTimersByTimeAsync(120_000)
    expect(refrescar).not.toHaveBeenCalled()

    act(() => ocultarPestania(false))
    expect(refrescar).toHaveBeenCalledTimes(1)
  })

  it('al desmontar deja de llamar', async () => {
    const refrescar = vi.fn()
    const { unmount } = renderHook(() => useRefrescoPeriodico(refrescar, 30_000))

    unmount()
    await vi.advanceTimersByTimeAsync(90_000)

    expect(refrescar).not.toHaveBeenCalled()
  })
})
