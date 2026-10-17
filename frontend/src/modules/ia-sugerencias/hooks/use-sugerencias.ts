import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarSugerencias } from '@/modules/ia-sugerencias/services/listar-sugerencias'
import type { Sugerencia } from '@/modules/ia-sugerencias/types'

export function useSugerencias() {
  const [datos, setDatos] = useState<Sugerencia[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sinPermiso, setSinPermiso] = useState(false)

  const cargar = useCallback(() => {
    return listarSugerencias()
      .then((sugerencias) => {
        setDatos(sugerencias)
        setSinPermiso(false)
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) {
          setSinPermiso(true)
          return
        }
        setError(err instanceof ApiError ? err.detail : 'No se pudieron cargar las sugerencias.')
      })
      .finally(() => setCargando(false))
  }, [])

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
