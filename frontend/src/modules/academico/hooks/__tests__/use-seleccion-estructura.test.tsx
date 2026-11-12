import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { useSeleccionEstructura } from '@/modules/academico/hooks/use-seleccion-estructura'

function montar(url: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  )
  return renderHook(() => ({ seleccion: useSeleccionEstructura(), ubicacion: useLocation() }), {
    wrapper,
  })
}

describe('useSeleccionEstructura', () => {
  it('lee nivel, año y división de la URL', () => {
    const { result } = montar('/academico?nivel=n1&anio=a1&division=d1')
    expect(result.current.seleccion.pedida).toEqual({ nivel: 'n1', anio: 'a1', division: 'd1' })
  })

  it('sin parámetros no pide nada', () => {
    const { result } = montar('/academico')
    expect(result.current.seleccion.pedida).toEqual({ nivel: null, anio: null, division: null })
  })

  it('al cambiar de nivel descarta año y división', () => {
    const { result } = montar('/academico?nivel=n1&anio=a1&division=d1')
    act(() => result.current.seleccion.elegir({ nivel: 'n2' }))
    expect(result.current.ubicacion.search).toBe('?nivel=n2')
  })

  it('al cambiar de año conserva el nivel y descarta la división', () => {
    const { result } = montar('/academico?nivel=n1&anio=a1&division=d1')
    act(() => result.current.seleccion.elegir({ nivel: 'n1', anio: 'a2' }))
    expect(result.current.ubicacion.search).toBe('?nivel=n1&anio=a2')
  })

  it('guarda la selección completa al elegir una división', () => {
    const { result } = montar('/academico')
    act(() => result.current.seleccion.elegir({ nivel: 'n1', anio: 'a1', division: 'd2' }))
    expect(result.current.ubicacion.search).toBe('?nivel=n1&anio=a1&division=d2')
  })

  it('ir a un curso arma la selección completa y pide resaltar la materia', () => {
    const { result } = montar('/academico?nivel=n1&anio=a1&division=d1')
    act(() => result.current.seleccion.irA({ nivel: 'n2', anio: 'a2', division: 'd2' }, 'mc9'))
    expect(result.current.ubicacion.search).toBe('?nivel=n2&anio=a2&division=d2&resaltar=mc9')
  })
})
