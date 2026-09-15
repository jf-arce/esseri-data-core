import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { useAlumnosDivision } from '@/modules/academico/hooks/use-alumnos-division'
import { listarInscripciones } from '@/modules/inscripciones/services/listar-inscripciones'
import type { InscripcionListadoItem } from '@/modules/inscripciones/types'

vi.mock('@/modules/inscripciones/services/listar-inscripciones')

const mockedListarInscripciones = vi.mocked(listarInscripciones)

function inscripcion(overrides: Partial<InscripcionListadoItem>): InscripcionListadoItem {
  return {
    id: 'inscripcion-1',
    ciclo_lectivo: '2027',
    fecha_inscripcion: '2026-08-28',
    tipo: 'nueva',
    estado: 'activa',
    alumno_id: 'alumno-1',
    alumno_nombre: 'Ana',
    alumno_apellido: 'Pérez',
    numero_legajo: 'A-001',
    division_id: 'division-1',
    division_nombre: '1°A',
    anio_numero: 1,
    nivel_educativo_nombre: 'Primario',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useAlumnosDivision', () => {
  it('no consulta nada sin división elegida', async () => {
    const { result } = renderHook(() => useAlumnosDivision(null))

    await waitFor(() => expect(result.current.cargando).toBe(false))

    expect(mockedListarInscripciones).not.toHaveBeenCalled()
    expect(result.current.alumnos).toEqual([])
  })

  it('filtra por división e ignora inscripciones inactivas o de otra división', async () => {
    mockedListarInscripciones.mockResolvedValue({
      items: [
        inscripcion({ id: 'insc-1', division_id: 'division-1', estado: 'activa' }),
        inscripcion({ id: 'insc-2', division_id: 'division-1', estado: 'finalizada' }),
        inscripcion({ id: 'insc-3', division_id: 'division-2', estado: 'activa' }),
      ],
      total: 3,
      pagina: 1,
      tamanio_pagina: 100,
      total_paginas: 1,
    })

    const { result } = renderHook(() => useAlumnosDivision('division-1'))

    await waitFor(() => expect(result.current.cargando).toBe(false))

    expect(result.current.alumnos).toHaveLength(1)
    expect(result.current.alumnos[0].id).toBe('insc-1')
  })

  it('distingue la falta de permiso de un error general', async () => {
    mockedListarInscripciones.mockRejectedValue(new ApiError(403, 'Sin permiso'))

    const { result } = renderHook(() => useAlumnosDivision('division-1'))

    await waitFor(() => expect(result.current.cargando).toBe(false))

    expect(result.current.sinPermiso).toBe(true)
    expect(result.current.error).toBeNull()
  })
})
