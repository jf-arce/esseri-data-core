import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { useVistaDivision } from '@/modules/academico/hooks/use-vista-division'
import type { MateriaCurso } from '@/modules/academico/types'

const materiaCurso: MateriaCurso = {
  id: 'mc1',
  materia_id: 'm1',
  materia_nombre: 'Lengua',
  materia_tipo: 'materia',
  materia_color: null,
  division_id: 'd1',
  division_nombre: '1°A',
  anio_id: 'a1',
  anio_numero: 1,
  nivel_educativo_id: 'n1',
  nivel_educativo_nombre: 'Primario',
  horarios: [],
  cantidad_asignaciones: 0,
  created_at: '',
  updated_at: '',
}

function montar(url = '/academico') {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  )
  return renderHook(() => ({ vista: useVistaDivision(), ubicacion: useLocation() }), { wrapper })
}

describe('useVistaDivision', () => {
  it('arranca en la lista de materias, sin resaltado', () => {
    const { result } = montar()
    expect(result.current.vista.vista).toBe('materias')
    expect(result.current.vista.resaltadasIds).toEqual([])
  })

  it('ver en el horario cambia la pestaña y resalta la materia', () => {
    const { result } = montar()
    act(() => result.current.vista.verEnHorario(materiaCurso))
    expect(result.current.vista.vista).toBe('horario')
    expect(result.current.vista.resaltadasIds).toEqual(['mc1'])
  })

  it('volver a la lista elimina el resaltado', () => {
    const { result } = montar()
    act(() => result.current.vista.verEnHorario(materiaCurso))
    act(() => result.current.vista.cambiarVista('materias'))
    expect(result.current.vista.resaltadasIds).toEqual([])
  })

  it('se pueden resaltar varias materias y quitarlas juntas', () => {
    const { result } = montar()
    act(() => result.current.vista.alternarResaltada('mc1'))
    act(() => result.current.vista.alternarResaltada('mc2'))
    expect(result.current.vista.resaltadasIds).toEqual(['mc1', 'mc2'])
    act(() => result.current.vista.alternarResaltada('mc1'))
    expect(result.current.vista.resaltadasIds).toEqual(['mc2'])
    act(() => result.current.vista.quitarResaltado())
    expect(result.current.vista.resaltadasIds).toEqual([])
  })

  it('el filtro se conserva al cambiar de pestaña', () => {
    const { result } = montar()
    act(() => result.current.vista.setFiltro({ ...result.current.vista.filtro, texto: 'len' }))
    act(() => result.current.vista.cambiarVista('horario'))
    expect(result.current.vista.filtro.texto).toBe('len')
  })

  it('toma de la URL la materia a destacar y la quita sin tocar el resto', () => {
    const { result } = montar('/academico?nivel=n1&division=d1&resaltar=mc1')
    expect(result.current.vista.destacadaId).toBe('mc1')

    act(() => result.current.vista.quitarDestacada())

    expect(result.current.vista.destacadaId).toBeNull()
    expect(result.current.ubicacion.search).toBe('?nivel=n1&division=d1')
  })
})
