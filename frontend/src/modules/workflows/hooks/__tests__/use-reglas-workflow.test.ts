import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { useReglasWorkflow } from '@/modules/workflows/hooks/use-reglas-workflow'
import { listarReglasWorkflow } from '@/modules/workflows/services/listar-reglas-workflow'
import { reglaDe } from '@/modules/workflows/__tests__/fabricas'

vi.mock('@/modules/workflows/services/listar-reglas-workflow')

const mockedListar = vi.mocked(listarReglasWorkflow)

const regla = reglaDe()

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useReglasWorkflow', () => {
  it('carga las reglas', async () => {
    mockedListar.mockResolvedValue([regla])

    const { result } = renderHook(() => useReglasWorkflow())
    expect(result.current.cargando).toBe(true)

    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.reglas).toEqual([regla])
    expect(result.current.error).toBeNull()
  })

  it('marca sinPermiso ante un 403 y no lo trata como error', async () => {
    mockedListar.mockRejectedValue(new ApiError(403, 'Sin permiso'))

    const { result } = renderHook(() => useReglasWorkflow())

    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.sinPermiso).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('informa el detalle del backend en otros errores', async () => {
    mockedListar.mockRejectedValue(new ApiError(500, 'Falló la base'))

    const { result } = renderHook(() => useReglasWorkflow())

    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.error).toBe('Falló la base')
    expect(result.current.sinPermiso).toBe(false)
  })

  it('vuelve a consultar al recargar', async () => {
    mockedListar.mockResolvedValueOnce([]).mockResolvedValueOnce([regla])

    const { result } = renderHook(() => useReglasWorkflow())
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.reglas).toEqual([])

    act(() => result.current.recargar())
    await waitFor(() => expect(result.current.reglas).toEqual([regla]))
    expect(mockedListar).toHaveBeenCalledTimes(2)
  })

  it('al recargar conserva las reglas y no vuelve a "cargando"', async () => {
    let resolver: (reglas: (typeof regla)[]) => void = () => {}
    mockedListar.mockResolvedValueOnce([regla]).mockReturnValueOnce(
      new Promise((resolve) => {
        resolver = resolve
      }),
    )

    const { result } = renderHook(() => useReglasWorkflow())
    await waitFor(() => expect(result.current.cargando).toBe(false))

    act(() => result.current.recargar())

    expect(result.current.cargando).toBe(false)
    expect(result.current.reglas).toEqual([regla])
    await act(async () => resolver([regla]))
  })

  it('reemplazar actualiza una regla en memoria', async () => {
    mockedListar.mockResolvedValue([regla])
    const { result } = renderHook(() => useReglasWorkflow())
    await waitFor(() => expect(result.current.cargando).toBe(false))

    act(() => result.current.reemplazar({ ...regla, activo: false }))

    expect(result.current.reglas[0].activo).toBe(false)
  })
})
