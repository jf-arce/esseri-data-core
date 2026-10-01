import { useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { obtenerReglaWorkflow } from '@/modules/workflows/services/obtener-regla-workflow'
import type { ReglaWorkflow } from '@/modules/workflows/types'

/** Carga una regla por id para el editor. Sin `id` (alta) no pide nada. */
export function useReglaWorkflow(id: string | undefined) {
  const [resultado, setResultado] = useState<{
    id: string | undefined
    regla: ReglaWorkflow | null
    noEncontrada: boolean
    error: string | null
  }>({ id: undefined, regla: null, noEncontrada: false, error: null })

  useEffect(() => {
    if (id === undefined) return
    const controller = new AbortController()
    obtenerReglaWorkflow(id, controller.signal)
      .then((regla) => setResultado({ id, regla, noEncontrada: false, error: null }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        // 422: un id que no es UUID tampoco corresponde a ninguna regla.
        const noEncontrada =
          error instanceof ApiError && (error.status === 404 || error.status === 422)
        setResultado({
          id,
          regla: null,
          noEncontrada,
          error: noEncontrada
            ? null
            : error instanceof ApiError
              ? error.detail
              : 'No se pudo cargar la regla.',
        })
      })
    return () => controller.abort()
  }, [id])

  const vigente = id === undefined || resultado.id === id
  return {
    regla: vigente ? resultado.regla : null,
    cargando: !vigente,
    noEncontrada: vigente && resultado.noEncontrada,
    error: vigente ? resultado.error : null,
  }
}
