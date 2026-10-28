import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { useAbrirDesdeUrl } from '@/hooks/use-abrir-desde-url'

function renderizar(rutaInicial: string, alAbrir: () => void) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[rutaInicial]}>{children}</MemoryRouter>
  )
  return renderHook(
    () => {
      useAbrirDesdeUrl('crear', alAbrir)
      return { location: useLocation(), navigate: useNavigate() }
    },
    { wrapper },
  )
}

describe('useAbrirDesdeUrl', () => {
  it('no hace nada sin el parámetro', () => {
    const alAbrir = vi.fn()
    renderizar('/proveedores', alAbrir)

    expect(alAbrir).not.toHaveBeenCalled()
  })

  it('abre al entrar con ?crear=1 y limpia solo ese parámetro', () => {
    const alAbrir = vi.fn()
    const { result } = renderizar('/proveedores?crear=1&buscar=ab', alAbrir)

    expect(alAbrir).toHaveBeenCalledTimes(1)
    expect(result.current.location.search).toBe('?buscar=ab')
  })

  it('vuelve a abrir si el buscador navega otra vez con la página ya montada', () => {
    const alAbrir = vi.fn()
    const { result } = renderizar('/proveedores?crear=1', alAbrir)

    act(() => result.current.navigate('/proveedores?crear=1'))

    expect(alAbrir).toHaveBeenCalledTimes(2)
    expect(result.current.location.search).toBe('')
  })

  it('ignora valores distintos de 1', () => {
    const alAbrir = vi.fn()
    renderizar('/proveedores?crear=0', alAbrir)

    expect(alAbrir).not.toHaveBeenCalled()
  })
})
