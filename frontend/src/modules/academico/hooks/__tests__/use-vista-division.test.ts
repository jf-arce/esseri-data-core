import { act, renderHook } from '@testing-library/react'
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

describe('useVistaDivision', () => {
  it('arranca en la lista de materias, sin resaltado', () => {
    const { result } = renderHook(() => useVistaDivision())
    expect(result.current.vista).toBe('materias')
    expect(result.current.resaltadaId).toBeNull()
  })

  it('ver en el horario cambia la pestaña y resalta la materia', () => {
    const { result } = renderHook(() => useVistaDivision())
    act(() => result.current.verEnHorario(materiaCurso))
    expect(result.current.vista).toBe('horario')
    expect(result.current.resaltadaId).toBe('mc1')
  })

  it('volver a la lista elimina el resaltado', () => {
    const { result } = renderHook(() => useVistaDivision())
    act(() => result.current.verEnHorario(materiaCurso))
    act(() => result.current.cambiarVista('materias'))
    expect(result.current.resaltadaId).toBeNull()
  })

  it('el filtro se conserva al cambiar de pestaña', () => {
    const { result } = renderHook(() => useVistaDivision())
    act(() => result.current.setFiltro({ ...result.current.filtro, texto: 'len' }))
    act(() => result.current.cambiarVista('horario'))
    expect(result.current.filtro.texto).toBe('len')
  })
})
