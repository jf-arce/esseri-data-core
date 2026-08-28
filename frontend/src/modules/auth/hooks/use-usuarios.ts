import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { getUsuarios } from '@/modules/auth/services/get-usuarios'
import type { UsuarioConRoles } from '@/modules/auth/types'

export function useUsuarios() {
  const [datos, setDatos] = useState<UsuarioConRoles[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(() => {
    return getUsuarios()
      .then(setDatos)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.detail : 'No se pudieron cargar los usuarios.'),
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
