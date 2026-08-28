import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { useInscripciones } from '@/modules/inscripciones/hooks/use-inscripciones'
import { listarInscripciones } from '@/modules/inscripciones/services/listar-inscripciones'
import type { FiltrosInscripciones, InscripcionListado } from '@/modules/inscripciones/types'

vi.mock('@/modules/inscripciones/services/listar-inscripciones')

const mockedListarInscripciones = vi.mocked(listarInscripciones)
const filtros: FiltrosInscripciones = { pagina: 1, tamanioPagina: 10 }
const listado: InscripcionListado = {
  items: [
    {
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
      division_nombre: '1° A',
      anio_numero: 1,
      nivel_educativo_nombre: 'Primario',
    },
  ],
  total: 1,
  pagina: 1,
  tamanio_pagina: 10,
  total_paginas: 1,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useInscripciones', () => {
  it('carga el listado y finaliza el estado de carga', async () => {
    mockedListarInscripciones.mockResolvedValue(listado)

    const { result } = renderHook(() => useInscripciones(filtros))

    await waitFor(() => expect(result.current.cargando).toBe(false))

    expect(result.current.datos).toEqual(listado)
    expect(result.current.error).toBeNull()
    expect(result.current.sinPermiso).toBe(false)
  })

  it('distingue la falta de permiso de un error general', async () => {
    mockedListarInscripciones.mockRejectedValue(new ApiError(403, 'Sin permiso'))

    const { result } = renderHook(() => useInscripciones(filtros))

    await waitFor(() => expect(result.current.cargando).toBe(false))

    expect(result.current.sinPermiso).toBe(true)
    expect(result.current.error).toBeNull()
  })
})
