import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { getRoles } from '@/modules/auth/services/get-roles'
import type { Rol } from '@/modules/auth/types'

export function useRoles() {
  const [datos, setDatos] = useState<Rol[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Separado de `recargar`: el efecto de montaje invoca esta función directamente, y no
  // debe llamar a un setState de forma síncrona en el cuerpo del efecto — el estado inicial
  // (`cargando: true`, `error: null`) ya cubre ese primer fetch, así que acá solo se
  // actualiza estado dentro de callbacks de la promesa (asíncronos).
  const cargar = useCallback(() => {
    return getRoles()
      .then(setDatos)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.detail : 'No se pudieron cargar los roles.'),
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
