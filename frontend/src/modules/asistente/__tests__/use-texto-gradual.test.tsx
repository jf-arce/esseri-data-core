import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTextoGradual } from '../hooks/use-texto-gradual'

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useTextoGradual', () => {
  it('sin animar devuelve el texto entero', () => {
    const { result } = renderHook(() => useTextoGradual('Hola mundo', false))
    expect(result.current).toEqual({ visible: 'Hola mundo', revelando: false })
  })

  it('animando revela el texto de a poco hasta completarlo', () => {
    const { result } = renderHook(() => useTextoGradual('Hay 3 alumnos activos hoy.', true))
    expect(result.current.visible).toBe('')
    expect(result.current.revelando).toBe(true)

    act(() => {
      vi.advanceTimersByTime(32)
    })
    expect(result.current.visible.length).toBeGreaterThan(0)
    expect(result.current.visible.length).toBeLessThan('Hay 3 alumnos activos hoy.'.length)

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current).toEqual({
      visible: 'Hay 3 alumnos activos hoy.',
      revelando: false,
    })
  })

  it('con movimiento reducido muestra todo de una vez', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const { result } = renderHook(() => useTextoGradual('Hola', true))
    expect(result.current).toEqual({ visible: 'Hola', revelando: false })
  })
})
