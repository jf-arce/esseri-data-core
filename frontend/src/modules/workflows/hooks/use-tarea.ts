import { useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { obtenerTarea } from '@/modules/workflows/services/obtener-tarea'
import type { TareaDetalle } from '@/modules/workflows/types'

/** Con `id` en `null` no pide nada. `revision` fuerza a pedir de nuevo (p. ej. tras cambiar el
 * estado). La clave por id evita mostrar la cadena de otra tarea mientras carga. */
export function useTarea(id: string | null, revision = 0) {
  const [resultado, setResultado] = useState<{
    clave: string | null
    datos: TareaDetalle | null
    error: string | null
  }>({ clave: null, datos: null, error: null })

  const clave = id === null ? null : `${id}:${revision}`

  useEffect(() => {
    if (id === null) return
    const controller = new AbortController()

    obtenerTarea(id, controller.signal)
      .then((datos) => {
        if (controller.signal.aborted) return
        setResultado({ clave: `${id}:${revision}`, datos, error: null })
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setResultado({
          clave: `${id}:${revision}`,
          datos: null,
          error: err instanceof ApiError ? err.detail : 'No se pudo cargar la tarea.',
        })
      })

    return () => controller.abort()
  }, [id, revision])

  const vigente = clave !== null && resultado.clave === clave
  return {
    datos: vigente ? resultado.datos : null,
    error: vigente ? resultado.error : null,
    cargando: clave !== null && !vigente,
  }
}
