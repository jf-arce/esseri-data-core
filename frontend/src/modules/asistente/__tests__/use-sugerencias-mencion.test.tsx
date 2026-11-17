import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

const listarAlumnos = vi.fn()
const listarFamilias = vi.fn()
const listarDocentes = vi.fn()
vi.mock('@/modules/familias-alumnos/services/listar-alumnos', () => ({
  listarAlumnos: (...args: unknown[]) => listarAlumnos(...args),
}))
vi.mock('@/modules/familias-alumnos/services/listar-familias', () => ({
  listarFamilias: (...args: unknown[]) => listarFamilias(...args),
}))
vi.mock('@/modules/academico/services/docentes', () => ({
  listarDocentes: () => listarDocentes(),
}))
vi.mock('@/modules/academico/services/niveles-educativos', () => ({
  listarNiveles: () => Promise.resolve([{ id: 'n1', nombre: 'Primaria' }]),
}))
vi.mock('@/modules/academico/services/anios', () => ({
  listarAnios: () => Promise.resolve([{ id: 'a1', numero: 5, nivel_educativo_id: 'n1' }]),
}))
vi.mock('@/modules/academico/services/divisiones', () => ({
  listarDivisiones: () => Promise.resolve([{ id: 'd1', nombre: 'A', anio_id: 'a1' }]),
}))

import { useSugerenciasMencion } from '../hooks/use-sugerencias-mencion'

beforeEach(() => {
  vi.clearAllMocks()
  listarAlumnos.mockResolvedValue([{ id: 'al1', persona_nombre: 'Ana', persona_apellido: 'Roca' }])
  listarFamilias.mockResolvedValue([])
  listarDocentes.mockResolvedValue([{ id: 'do1', nombre: 'Elena', apellido: 'Rojas' }])
})

it('agrupa alumnos, docentes y cursos que coinciden con lo escrito', async () => {
  const { result } = renderHook(() =>
    useSugerenciasMencion('5', { personas: true, academico: true }),
  )
  await waitFor(() =>
    expect(result.current.sugerencias.map((s) => s.tipo)).toEqual(['ALUMNO', 'CURSO']),
  )
  expect(result.current.sugerencias[1]).toMatchObject({ id: 'd1', nombre: '5°A de Primaria' })
})

it('filtra los docentes por nombre sin distinguir tildes', async () => {
  const { result } = renderHook(() =>
    useSugerenciasMencion('ROJAS', { personas: false, academico: true }),
  )
  await waitFor(() => expect(result.current.sugerencias).toHaveLength(1))
  expect(result.current.sugerencias[0]).toMatchObject({ tipo: 'DOCENTE', nombre: 'Elena Rojas' })
  expect(listarAlumnos).not.toHaveBeenCalled()
})

it('sin permisos no consulta nada', () => {
  const { result } = renderHook(() =>
    useSugerenciasMencion('a', { personas: false, academico: false }),
  )
  expect(result.current).toEqual({ sugerencias: [], buscando: false })
  expect(listarDocentes).not.toHaveBeenCalled()
})

it('está buscando desde que cambia lo escrito hasta que llegan los resultados', async () => {
  const { result } = renderHook(() =>
    useSugerenciasMencion('5', { personas: true, academico: true }),
  )
  expect(result.current.buscando).toBe(true)
  await waitFor(() => expect(result.current.buscando).toBe(false))
  expect(result.current.sugerencias.length).toBeGreaterThan(0)
})

it('sin lo escrito no busca', () => {
  const { result } = renderHook(() =>
    useSugerenciasMencion(null, { personas: true, academico: true }),
  )
  expect(result.current).toEqual({ sugerencias: [], buscando: false })
})

it.each(['5a', '5 a', '5° a', 'prim', '5a primaria', 'A'])(
  'el curso 5°A de Primaria aparece al escribir "%s"',
  async (escrito) => {
    const { result } = renderHook(() =>
      useSugerenciasMencion(escrito, { personas: false, academico: true }),
    )
    await waitFor(() => expect(result.current.buscando).toBe(false))
    expect(result.current.sugerencias.map((s) => s.nombre)).toEqual(['5°A de Primaria'])
  },
)

it.each(['5b', '6', 'secundaria'])('el curso 5°A no aparece al escribir "%s"', async (escrito) => {
  const { result } = renderHook(() =>
    useSugerenciasMencion(escrito, { personas: false, academico: true }),
  )
  await waitFor(() => expect(result.current.buscando).toBe(false))
  expect(result.current.sugerencias).toEqual([])
})

it('busca personas solo por nombre y apellido, no por DNI', async () => {
  const { result } = renderHook(() =>
    useSugerenciasMencion('1', { personas: true, academico: false }),
  )
  await waitFor(() => expect(result.current.buscando).toBe(false))
  expect(listarAlumnos).toHaveBeenCalledWith({ buscar: '1', solo_nombre: true }, expect.anything())
  expect(listarFamilias).toHaveBeenCalledWith({ buscar: '1', solo_nombre: true }, expect.anything())
})
