import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { useEstructuraAcademica } from '@/modules/academico/hooks/use-estructura-academica'
import { listarAnios } from '@/modules/academico/services/anios'
import { listarAsignaciones } from '@/modules/academico/services/asignaciones-docentes'
import { listarDivisiones } from '@/modules/academico/services/divisiones'
import { listarDocentes } from '@/modules/academico/services/docentes'
import { listarMaterias } from '@/modules/academico/services/materias'
import { listarMateriasCurso } from '@/modules/academico/services/materias-curso'
import { listarNiveles } from '@/modules/academico/services/niveles-educativos'
import type { Anio, Division, MateriaCurso, NivelEducativo } from '@/modules/academico/types'

vi.mock('@/modules/academico/services/anios')
vi.mock('@/modules/academico/services/asignaciones-docentes')
vi.mock('@/modules/academico/services/divisiones')
vi.mock('@/modules/academico/services/docentes')
vi.mock('@/modules/academico/services/materias')
vi.mock('@/modules/academico/services/materias-curso')
vi.mock('@/modules/academico/services/niveles-educativos')

const marca = { created_at: '', updated_at: '' }
const niveles: NivelEducativo[] = [
  { id: 'n1', nombre: 'Inicial', cantidad_anios: 0, ...marca },
  { id: 'n2', nombre: 'Primario', cantidad_anios: 2, ...marca },
]
const anios: Anio[] = [
  {
    id: 'a1',
    numero: 1,
    nivel_educativo_id: 'n2',
    cantidad_divisiones: 2,
    cantidad_materias: 0,
    ...marca,
  },
  {
    id: 'a2',
    numero: 2,
    nivel_educativo_id: 'n2',
    cantidad_divisiones: 0,
    cantidad_materias: 0,
    ...marca,
  },
]
const divisiones: Division[] = [
  {
    id: 'd1',
    nombre: '1°A',
    anio_id: 'a1',
    cantidad_materias: 1,
    cantidad_inscripciones: 3,
    cantidad_asignaciones: 0,
    ...marca,
  },
  {
    id: 'd2',
    nombre: '1°B',
    anio_id: 'a1',
    cantidad_materias: 0,
    cantidad_inscripciones: 0,
    cantidad_asignaciones: 0,
    ...marca,
  },
]

function materiaCurso(id: string, divisionId: string): MateriaCurso {
  return {
    id,
    materia_id: `m-${id}`,
    materia_nombre: 'Lengua',
    materia_tipo: 'materia',
    division_id: divisionId,
    division_nombre: null,
    anio_id: 'a1',
    anio_numero: 1,
    nivel_educativo_id: 'n2',
    nivel_educativo_nombre: 'Primario',
    horarios: [],
    cantidad_asignaciones: 0,
    ...marca,
  }
}

const sinSeleccion = { nivel: null, anio: null, division: null }

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listarNiveles).mockResolvedValue(niveles)
  vi.mocked(listarMaterias).mockResolvedValue([])
  vi.mocked(listarDocentes).mockResolvedValue([])
  vi.mocked(listarAnios).mockResolvedValue(anios)
  vi.mocked(listarDivisiones).mockResolvedValue(divisiones)
  vi.mocked(listarMateriasCurso).mockResolvedValue([
    materiaCurso('mc1', 'd1'),
    materiaCurso('mc2', 'd2'),
  ])
  vi.mocked(listarAsignaciones).mockResolvedValue([])
})

describe('useEstructuraAcademica', () => {
  it('sin selección elige el primer nivel, año y división', async () => {
    const { result } = renderHook(() => useEstructuraAcademica(sinSeleccion))

    await waitFor(() => expect(result.current.division?.id).toBe('d1'))

    expect(result.current.nivel?.id).toBe('n1')
    expect(listarAnios).toHaveBeenCalledWith('n1')
  })

  it('carga solo los años del nivel pedido y las materias de la división elegida', async () => {
    const { result } = renderHook(() =>
      useEstructuraAcademica({ nivel: 'n2', anio: 'a1', division: 'd2' }),
    )

    await waitFor(() => expect(result.current.materiasCurso).toHaveLength(1))

    expect(listarAnios).toHaveBeenCalledTimes(1)
    expect(listarAnios).toHaveBeenCalledWith('n2')
    expect(listarMateriasCurso).toHaveBeenCalledWith({ anio_id: 'a1' })
    expect(result.current.materiasCurso[0].id).toBe('mc2')
    expect(listarAsignaciones).toHaveBeenCalledWith({ division_id: 'd2' })
  })

  it('si la selección de la URL ya no existe vuelve a la primera disponible', async () => {
    const { result } = renderHook(() =>
      useEstructuraAcademica({ nivel: 'n2', anio: 'inexistente', division: 'tampoco' }),
    )

    await waitFor(() => expect(result.current.division?.id).toBe('d1'))

    expect(result.current.anio?.id).toBe('a1')
  })

  it('un nivel sin años no consulta divisiones', async () => {
    vi.mocked(listarAnios).mockResolvedValue([])
    const { result } = renderHook(() => useEstructuraAcademica({ ...sinSeleccion, nivel: 'n1' }))

    await waitFor(() => expect(result.current.cargandoAnios).toBe(false))

    expect(result.current.anio).toBeUndefined()
    expect(listarDivisiones).not.toHaveBeenCalled()
  })

  it('informa la falta de permiso (403)', async () => {
    vi.mocked(listarNiveles).mockRejectedValue(new ApiError(403, 'Sin permiso'))
    const { result } = renderHook(() => useEstructuraAcademica(sinSeleccion))

    await waitFor(() => expect(result.current.sinPermiso).toBe(true))
  })

  it('informa otros errores con el detalle del servidor', async () => {
    vi.mocked(listarNiveles).mockRejectedValue(new ApiError(500, 'Falló la base'))
    const { result } = renderHook(() => useEstructuraAcademica(sinSeleccion))

    await waitFor(() => expect(result.current.error).toBe('Falló la base'))
    expect(result.current.sinPermiso).toBe(false)
  })
})
