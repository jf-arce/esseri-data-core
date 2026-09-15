import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { useHistorialAsistencia } from '@/modules/academico/hooks/use-historial-asistencia'
import {
  listarAsistencias,
  obtenerResumenAsistencia,
} from '@/modules/academico/services/asistencias'
import type { Asistencia, AsistenciaResumen } from '@/modules/academico/types'

vi.mock('@/modules/academico/services/asistencias')

const mockedListarAsistencias = vi.mocked(listarAsistencias)
const mockedObtenerResumen = vi.mocked(obtenerResumenAsistencia)

const registro: Asistencia = {
  id: 'asistencia-1',
  fecha: '2027-03-10',
  tipo: 'presente',
  inscripcion_id: 'inscripcion-1',
  updated_at: '2027-03-10T10:00:00',
}

const resumen: AsistenciaResumen = {
  inscripcion_id: 'inscripcion-1',
  alumno_id: 'alumno-1',
  fecha_desde: '2027-03-01',
  fecha_hasta: '2027-03-31',
  total_registros: 1,
  presentes: 1,
  tardanzas: 0,
  ausentes_pendientes: 0,
  ausentes_justificadas: 0,
  ausentes_injustificadas: 0,
  porcentaje_presencia: 100,
  porcentaje_justificadas: 0,
  porcentaje_injustificadas: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useHistorialAsistencia', () => {
  it('no consulta nada sin alumno elegido', async () => {
    const { result } = renderHook(() => useHistorialAsistencia(null, '2027-03-01', '2027-03-31'))

    await waitFor(() => expect(result.current.cargando).toBe(false))

    expect(mockedListarAsistencias).not.toHaveBeenCalled()
    expect(mockedObtenerResumen).not.toHaveBeenCalled()
    expect(result.current.historial).toEqual([])
    expect(result.current.resumen).toBeNull()
  })

  it('carga el historial y el resumen del período para la inscripción elegida', async () => {
    mockedListarAsistencias.mockResolvedValue([registro])
    mockedObtenerResumen.mockResolvedValue(resumen)

    const { result } = renderHook(() =>
      useHistorialAsistencia('inscripcion-1', '2027-03-01', '2027-03-31'),
    )

    await waitFor(() => expect(result.current.cargando).toBe(false))

    const filtrosEsperados = {
      inscripcion_id: 'inscripcion-1',
      fecha_desde: '2027-03-01',
      fecha_hasta: '2027-03-31',
    }
    expect(mockedListarAsistencias).toHaveBeenCalledWith(filtrosEsperados)
    expect(mockedObtenerResumen).toHaveBeenCalledWith(filtrosEsperados)
    expect(result.current.historial).toEqual([registro])
    expect(result.current.resumen).toEqual(resumen)
    expect(result.current.sinPermiso).toBe(false)
  })

  it('distingue la falta de permiso de un error general', async () => {
    mockedListarAsistencias.mockRejectedValue(new ApiError(403, 'Sin permiso'))
    mockedObtenerResumen.mockResolvedValue(resumen)

    const { result } = renderHook(() =>
      useHistorialAsistencia('inscripcion-1', '2027-03-01', '2027-03-31'),
    )

    await waitFor(() => expect(result.current.cargando).toBe(false))

    expect(result.current.sinPermiso).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('expone un error legible cuando la carga falla', async () => {
    mockedListarAsistencias.mockRejectedValue(new ApiError(500, 'Error interno'))
    mockedObtenerResumen.mockResolvedValue(resumen)

    const { result } = renderHook(() =>
      useHistorialAsistencia('inscripcion-1', '2027-03-01', '2027-03-31'),
    )

    await waitFor(() => expect(result.current.cargando).toBe(false))

    expect(result.current.error).toBe('Error interno')
  })
})
