import { useEffect, useState } from 'react'
import { obtenerEjecucionWorkflow } from '@/modules/workflows/services/obtener-ejecucion-workflow'
import type { EjecucionWorkflow } from '@/modules/workflows/types'

/** Con `id` en `null` no pide nada. Si falla, el detalle sigue con los datos del listado. */
export function useEjecucion(id: string | null) {
  const [resultado, setResultado] = useState<{
    id: string | null
    datos: EjecucionWorkflow | null
  }>({ id: null, datos: null })

  useEffect(() => {
    if (id === null) return
    const controller = new AbortController()

    obtenerEjecucionWorkflow(id, controller.signal)
      .then((datos) => {
        if (!controller.signal.aborted) setResultado({ id, datos })
      })
      .catch(() => {
        if (!controller.signal.aborted) setResultado({ id, datos: null })
      })

    return () => controller.abort()
  }, [id])

  return id !== null && resultado.id === id ? resultado.datos : null
}
