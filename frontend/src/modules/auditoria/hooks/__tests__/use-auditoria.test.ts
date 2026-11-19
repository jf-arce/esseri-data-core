import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { useAuditoria } from '@/modules/auditoria/hooks/use-auditoria'
import { listarAuditoria } from '@/modules/auditoria/services/listar-auditoria'
import type { AuditoriaListado, FiltrosAuditoria } from '@/modules/auditoria/types'

vi.mock('@/modules/auditoria/services/listar-auditoria')

const mockedListar = vi.mocked(listarAuditoria)

const FILTROS: FiltrosAuditoria = {
  busqueda: '',
  entidad: 'todos',
  campo: 'todos',
  usuarioId: 'todos',
  actorTipo: 'todos',
  origen: 'todos',
  desde: '',
  hasta: '',
  orden: 'fecha-desc',
  pagina: 1,
  tamanioPagina: 20,
}

const listado: AuditoriaListado = {
  items: [
    {
      id: 'log-1',
      entidad: 'alumno',
      entidad_id: 'alumno-1',
      campo: 'estado',
      valor_anterior: 'activo',
      valor_nuevo: 'inactivo',
      fecha: '2027-01-01T10:00:00',
      usuario_id: 'u1',
      usuario_email: 'admin@esseri.edu.ar',
      actor_tipo: 'usuario',
      origen: 'edicion_manual',
      motivo: null,
      referencia_entidad: null,
      referencia_id: null,
    },
  ],
  total: 1,
  pagina: 1,
  tamanio_pagina: 20,
  total_paginas: 1,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useAuditoria', () => {
  it('carga el listado y finaliza el estado de carga', async () => {
    mockedListar.mockResolvedValue(listado)

    const { result } = renderHook(() => useAuditoria(FILTROS))

    await waitFor(() => expect(result.current.cargando).toBe(false))

    expect(result.current.datos).toEqual(listado)
    expect(result.current.error).toBeNull()
    expect(result.current.sinPermiso).toBe(false)
  })

  it('distingue la falta de permiso de un error general', async () => {
    mockedListar.mockRejectedValue(new ApiError(403, 'Sin permiso'))

    const { result } = renderHook(() => useAuditoria(FILTROS))

    await waitFor(() => expect(result.current.cargando).toBe(false))

    expect(result.current.sinPermiso).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('expone un error legible cuando la carga falla', async () => {
    mockedListar.mockRejectedValue(new ApiError(500, 'Error interno'))

    const { result } = renderHook(() => useAuditoria(FILTROS))

    await waitFor(() => expect(result.current.cargando).toBe(false))

    expect(result.current.error).toBe('Error interno')
    expect(result.current.sinPermiso).toBe(false)
  })

  it('vuelve a consultar al cambiar un filtro', async () => {
    mockedListar.mockResolvedValue(listado)
    const { result, rerender } = renderHook(({ filtros }) => useAuditoria(filtros), {
      initialProps: { filtros: FILTROS },
    })
    await waitFor(() => expect(result.current.cargando).toBe(false))

    rerender({ filtros: { ...FILTROS, entidad: 'alumno', pagina: 2 } })

    await waitFor(() => expect(mockedListar).toHaveBeenCalledTimes(2))
    expect(mockedListar.mock.lastCall?.[0]).toMatchObject({ entidad: 'alumno', pagina: 2 })
  })

  it('no vuelve a consultar si los filtros no cambian', async () => {
    mockedListar.mockResolvedValue(listado)
    const { result, rerender } = renderHook(({ filtros }) => useAuditoria(filtros), {
      initialProps: { filtros: FILTROS },
    })
    await waitFor(() => expect(result.current.cargando).toBe(false))

    rerender({ filtros: { ...FILTROS } })

    expect(mockedListar).toHaveBeenCalledTimes(1)
  })
})
