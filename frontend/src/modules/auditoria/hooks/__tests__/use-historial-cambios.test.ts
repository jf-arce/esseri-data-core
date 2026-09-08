import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { useHistorialCambios } from '@/modules/auditoria/hooks/use-historial-cambios'
import { obtenerHistorial } from '@/modules/auditoria/services/obtener-historial'
import type { HistorialEntrada } from '@/modules/auditoria/types'

vi.mock('@/modules/auditoria/services/obtener-historial')

const mockedObtenerHistorial = vi.mocked(obtenerHistorial)

const entrada: HistorialEntrada = {
  id: 'entrada-1',
  campo: 'estado',
  valor_anterior: 'activo',
  valor_nuevo: 'inactivo',
  fecha: '2027-01-01T10:00:00',
  usuario_id: 'usuario-1',
  usuario_email: 'admin@esseri.edu.ar',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useHistorialCambios', () => {
  it('carga el historial y finaliza el estado de carga', async () => {
    mockedObtenerHistorial.mockResolvedValue([entrada])

    const { result } = renderHook(() => useHistorialCambios('ALUMNO', 'alumno-1'))

    await waitFor(() => expect(result.current.cargando).toBe(false))

    expect(mockedObtenerHistorial).toHaveBeenCalledWith('ALUMNO', 'alumno-1')
    expect(result.current.datos).toEqual([entrada])
    expect(result.current.error).toBeNull()
    expect(result.current.sinPermiso).toBe(false)
  })

  it('distingue la falta de permiso de un error general', async () => {
    mockedObtenerHistorial.mockRejectedValue(new ApiError(403, 'Sin permiso'))

    const { result } = renderHook(() => useHistorialCambios('ALUMNO', 'alumno-1'))

    await waitFor(() => expect(result.current.cargando).toBe(false))

    expect(result.current.sinPermiso).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('expone un error legible cuando la carga falla', async () => {
    mockedObtenerHistorial.mockRejectedValue(new ApiError(500, 'Error interno'))

    const { result } = renderHook(() => useHistorialCambios('ALUMNO', 'alumno-1'))

    await waitFor(() => expect(result.current.cargando).toBe(false))

    expect(result.current.error).toBe('Error interno')
    expect(result.current.sinPermiso).toBe(false)
  })
})
