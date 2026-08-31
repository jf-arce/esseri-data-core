import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarFamilias } from '@/modules/familias-alumnos/services/listar-familias'
import type { Familia } from '@/modules/familias-alumnos/types'

export function useFamilias() {
  const [datos, setDatos] = useState<Familia[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sinPermiso, setSinPermiso] = useState(false)

  const cargar = useCallback(() => {
    return listarFamilias()
      .then((familias) => {
        setDatos(familias)
        setSinPermiso(false)
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) {
          setSinPermiso(true)
          return
        }
        setError(err instanceof ApiError ? err.detail : 'No se pudieron cargar las familias.')
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
