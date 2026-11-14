import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

const obtenerAlumno = vi.fn()
const getFamiliaById = vi.fn()
vi.mock('@/modules/familias-alumnos/services/obtener-alumno', () => ({
  obtenerAlumno: (...args: unknown[]) => obtenerAlumno(...args),
}))
vi.mock('@/modules/familias-alumnos/services/create-familia', () => ({
  getFamiliaById: (...args: unknown[]) => getFamiliaById(...args),
}))

import { useContextoPantalla } from '../hooks/use-contexto-pantalla'
import { contextoDeRuta } from '../utils'

const ID = '3f2b8a52-6c1e-4d0a-9d55-0a9d1c5b7e11'
const ID_2 = '4f2b8a52-6c1e-4d0a-9d55-0a9d1c5b7e22'

beforeEach(() => {
  vi.clearAllMocks()
  obtenerAlumno.mockResolvedValue({ persona_nombre: 'Juan', persona_apellido: 'Pérez' })
})

it('detecta la ficha de un alumno o de una familia', () => {
  expect(contextoDeRuta(`/familias-alumnos/alumnos/${ID}`)).toEqual({
    tipo: 'ALUMNO',
    entidad_id: ID,
  })
  expect(contextoDeRuta(`/familias-alumnos/familias/${ID}`)).toEqual({
    tipo: 'FAMILIA',
    entidad_id: ID,
  })
})

it('ignora listados, formularios y rutas ajenas', () => {
  expect(contextoDeRuta('/familias-alumnos/alumnos')).toBeNull()
  expect(contextoDeRuta('/familias-alumnos/alumnos/nuevo')).toBeNull()
  expect(contextoDeRuta(`/familias-alumnos/alumnos/${ID}/editar`)).toBeNull()
  expect(contextoDeRuta('/panel')).toBeNull()
})

it('da el contexto con el nombre una vez cargado', async () => {
  const { result } = renderHook(() => useContextoPantalla(`/familias-alumnos/alumnos/${ID}`, true))
  expect(result.current.contexto).toBeNull()
  await waitFor(() => expect(result.current.nombre).toBe('Juan Pérez'))
  expect(result.current.contexto).toEqual({ tipo: 'ALUMNO', entidad_id: ID })
})

it('sin permiso para ver personas no pide nada ni da contexto', () => {
  const { result } = renderHook(() => useContextoPantalla(`/familias-alumnos/alumnos/${ID}`, false))
  expect(result.current.contexto).toBeNull()
  expect(obtenerAlumno).not.toHaveBeenCalled()
})

it('al descartar deja de dar contexto hasta abrir otra ficha', async () => {
  const { result, rerender } = renderHook(({ ruta }) => useContextoPantalla(ruta, true), {
    initialProps: { ruta: `/familias-alumnos/alumnos/${ID}` },
  })
  await waitFor(() => expect(result.current.contexto).not.toBeNull())
  act(() => result.current.descartar())
  expect(result.current.contexto).toBeNull()

  rerender({ ruta: `/familias-alumnos/alumnos/${ID_2}` })
  await waitFor(() => expect(result.current.contexto).toMatchObject({ entidad_id: ID_2 }))
})
