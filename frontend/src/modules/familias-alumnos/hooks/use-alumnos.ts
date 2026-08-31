import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarAlumnos } from '@/modules/familias-alumnos/services/listar-alumnos'
import type { Alumno } from '@/modules/familias-alumnos/types'

export function useAlumnos() {
  const [datos, setDatos] = useState<Alumno[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sinPermiso, setSinPermiso] = useState(false)

  const cargar = useCallback(() => {
    return listarAlumnos()
      .then((alumnos) => {
        setDatos(alumnos)
        setSinPermiso(false)
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) {
          setSinPermiso(true)
          return
        }
        setError(err instanceof ApiError ? err.detail : 'No se pudieron cargar los alumnos.')
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
