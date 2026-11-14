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
  await waitFor(() => expect(result.current.map((s) => s.tipo)).toEqual(['ALUMNO', 'CURSO']))
  expect(result.current[1]).toMatchObject({ id: 'd1', nombre: '5°A de Primaria' })
})

it('filtra los docentes por nombre sin distinguir tildes', async () => {
  const { result } = renderHook(() =>
    useSugerenciasMencion('ROJAS', { personas: false, academico: true }),
  )
  await waitFor(() => expect(result.current).toHaveLength(1))
  expect(result.current[0]).toMatchObject({ tipo: 'DOCENTE', nombre: 'Elena Rojas' })
  expect(listarAlumnos).not.toHaveBeenCalled()
})

it('sin permisos no consulta nada', () => {
  const { result } = renderHook(() =>
    useSugerenciasMencion('a', { personas: false, academico: false }),
  )
  expect(result.current).toEqual([])
  expect(listarDocentes).not.toHaveBeenCalled()
})
