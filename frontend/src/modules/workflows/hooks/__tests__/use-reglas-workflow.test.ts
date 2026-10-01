import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { useReglasWorkflow } from '@/modules/workflows/hooks/use-reglas-workflow'
import { listarReglasWorkflow } from '@/modules/workflows/services/listar-reglas-workflow'
import type { ReglaWorkflow } from '@/modules/workflows/types'

vi.mock('@/modules/workflows/services/listar-reglas-workflow')

const mockedListar = vi.mocked(listarReglasWorkflow)

const regla: ReglaWorkflow = {
  id: 'r-1',
  nombre: 'Aviso de mora',
  tipo_evento_id: 'e-1',
  condicion: {},
  tipo_accion: 'notificar',
  accion_config: {},
  criticidad: 'media',
  requiere_aprobacion_humana: false,
  notificacion_template_id: null,
  activo: true,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}

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
})
