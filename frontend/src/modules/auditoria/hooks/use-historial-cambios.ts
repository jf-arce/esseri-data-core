import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { obtenerHistorial } from '@/modules/auditoria/services/obtener-historial'
import type { HistorialEntrada } from '@/modules/auditoria/types'

export function useHistorialCambios(entidad: string, entidadId: string) {
  const [datos, setDatos] = useState<HistorialEntrada[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sinPermiso, setSinPermiso] = useState(false)

  const cargar = useCallback(() => {
    return obtenerHistorial(entidad, entidadId)
      .then((entradas) => {
        setDatos(entradas)
        setSinPermiso(false)
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) {
          setSinPermiso(true)
          return
        }
        setError(err instanceof ApiError ? err.detail : 'No se pudo cargar el historial.')
      })
      .finally(() => setCargando(false))
  }, [entidad, entidadId])

  useEffect(() => {
    cargar()
  }, [cargar])

  const recargar = useCallback(() => {
    setCargando(true)
    setError(null)
    return cargar()
  }, [cargar])

  return { datos, cargando, error, sinPermiso, recargar }
}
