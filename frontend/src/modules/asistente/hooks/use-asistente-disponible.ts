import { useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarConversaciones } from '../services/conversaciones'

/**
 * `false` si el backend tiene el asistente deshabilitado (503); `true` en cualquier otro caso,
 * incluso si la consulta falla por otra causa: un error pasajero no debe esconder el botón.
 */
export function useAsistenteDisponible(habilitadoPorPermiso: boolean): boolean {
  const [deshabilitado, setDeshabilitado] = useState(false)

  useEffect(() => {
    if (!habilitadoPorPermiso) return
    const controlador = new AbortController()
    listarConversaciones(controlador.signal).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 503) setDeshabilitado(true)
    })
    return () => controlador.abort()
  }, [habilitadoPorPermiso])

  return habilitadoPorPermiso && !deshabilitado
}
