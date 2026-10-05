import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { useEjecucionesWorkflow } from '@/modules/workflows/hooks/use-ejecuciones-workflow'
import { listarEjecucionesWorkflow } from '@/modules/workflows/services/listar-ejecuciones-workflow'
import type { EjecucionWorkflowListado, FiltrosEjecuciones } from '@/modules/workflows/types'

vi.mock('@/modules/workflows/services/listar-ejecuciones-workflow')

const mockedListar = vi.mocked(listarEjecucionesWorkflow)

const listado: EjecucionWorkflowListado = {
  items: [],
  total: 0,
  pagina: 1,
  tamanio_pagina: 20,
  total_paginas: 0,
}

const filtros: FiltrosEjecuciones = { pagina: 1, tamanioPagina: 20 }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useEjecucionesWorkflow', () => {
  it('carga el listado', async () => {
    mockedListar.mockResolvedValue(listado)

    const { result } = renderHook(() => useEjecucionesWorkflow(filtros))
    expect(result.current.cargando).toBe(true)

    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.datos).toEqual(listado)
    expect(result.current.error).toBeNull()
  })

  it('marca sinPermiso ante un 403 y no lo trata como error', async () => {
    mockedListar.mockRejectedValue(new ApiError(403, 'Sin permiso'))

    const { result } = renderHook(() => useEjecucionesWorkflow(filtros))

    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.sinPermiso).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('informa el detalle del backend en otros errores', async () => {
    mockedListar.mockRejectedValue(new ApiError(500, 'Falló la base'))

    const { result } = renderHook(() => useEjecucionesWorkflow(filtros))

    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.error).toBe('Falló la base')
  })

  it('hace una nueva solicitud al cambiar los filtros', async () => {
    mockedListar.mockResolvedValue(listado)

    const { result, rerender } = renderHook((props) => useEjecucionesWorkflow(props), {
      initialProps: filtros,
    })
    await waitFor(() => expect(result.current.cargando).toBe(false))

    rerender({ estado: 'fallido', pagina: 2, tamanioPagina: 20 })
    await waitFor(() => expect(mockedListar).toHaveBeenCalledTimes(2))

    expect(mockedListar.mock.calls[1][0]).toEqual({
      estado: 'fallido',
      pagina: 2,
      tamanioPagina: 20,
    })
  })
})
