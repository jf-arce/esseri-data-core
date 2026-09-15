import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import {
  listarAsistencias,
  obtenerResumenAsistencia,
} from '@/modules/academico/services/asistencias'
import type { Asistencia, AsistenciaResumen } from '@/modules/academico/types'

export function useHistorialAsistencia(
  inscripcionId: string | null,
  fechaDesde: string,
  fechaHasta: string,
) {
  const [historial, setHistorial] = useState<Asistencia[]>([])
  const [resumen, setResumen] = useState<AsistenciaResumen | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sinPermiso, setSinPermiso] = useState(false)

  const cargar = useCallback(async () => {
    if (!inscripcionId) {
      setHistorial([])
      setResumen(null)
      setCargando(false)
      return
    }

    setCargando(true)
    setError(null)
    try {
      const filtros = {
        inscripcion_id: inscripcionId,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
      }
      const [registros, resumenCalculado] = await Promise.all([
        listarAsistencias(filtros),
        obtenerResumenAsistencia(filtros),
      ])
      setHistorial(registros)
      setResumen(resumenCalculado)
      setSinPermiso(false)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 403) {
        setSinPermiso(true)
      } else {
        setError(
          err instanceof ApiError ? err.detail : 'No se pudo cargar el historial de asistencia.',
        )
      }
    } finally {
      setCargando(false)
    }
  }, [inscripcionId, fechaDesde, fechaHasta])

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      await cargar()
      if (cancelado) return
    })()
    return () => {
      cancelado = true
    }
  }, [cargar])

  const recargar = useCallback(() => cargar(), [cargar])

  return { historial, resumen, cargando, error, sinPermiso, recargar }
}
