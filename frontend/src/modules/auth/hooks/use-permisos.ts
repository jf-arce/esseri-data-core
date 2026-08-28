import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { getPermisos } from '@/modules/auth/services/get-permisos'
import type { Permiso } from '@/modules/auth/types'

export function usePermisos() {
  const [datos, setDatos] = useState<Permiso[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(() => {
    return getPermisos()
      .then(setDatos)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.detail : 'No se pudieron cargar los permisos.'),
      )
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

  return { datos, cargando, error, recargar }
}
