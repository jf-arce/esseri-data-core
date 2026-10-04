import { useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { obtenerNotificacion } from '@/modules/workflows/services/obtener-notificacion'
import type { NotificacionEnviadaDetalle } from '@/modules/workflows/types'

/** Con `id` en `null` no pide nada. La clave por id evita mostrar el cuerpo de otra notificación. */
export function useNotificacion(id: string | null) {
  const [resultado, setResultado] = useState<{
    id: string | null
    datos: NotificacionEnviadaDetalle | null
    error: string | null
  }>({ id: null, datos: null, error: null })

  useEffect(() => {
    if (id === null) return
    const controller = new AbortController()

    obtenerNotificacion(id, controller.signal)
      .then((datos) => {
        if (controller.signal.aborted) return
        setResultado({ id, datos, error: null })
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setResultado({
          id,
          datos: null,
          error: err instanceof ApiError ? err.detail : 'No se pudo cargar la notificación.',
        })
      })

    return () => controller.abort()
  }, [id])

  const vigente = id !== null && resultado.id === id
  return {
    datos: vigente ? resultado.datos : null,
    error: vigente ? resultado.error : null,
    cargando: id !== null && !vigente,
  }
}
