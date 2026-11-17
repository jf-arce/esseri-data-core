import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { obtenerResumenWorkflows } from '@/modules/workflows/services/obtener-resumen-workflows'
import type { ResumenWorkflows } from '@/modules/workflows/types'

export function useResumenWorkflows() {
  const [revision, setRevision] = useState(0)
  const [resultado, setResultado] = useState<{
    revision: number | null
    resumen: ResumenWorkflows | null
    error: string | null
  }>({ revision: null, resumen: null, error: null })
  const recargar = useCallback(() => setRevision((actual) => actual + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    obtenerResumenWorkflows(undefined, controller.signal)
      .then((resumen) => setResultado({ revision, resumen, error: null }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setResultado((actual) => ({
          revision,
          resumen: actual.resumen,
          error:
            error instanceof ApiError
              ? error.detail
              : 'No se pudo cargar el resumen de las reglas.',
        }))
      })
    return () => controller.abort()
  }, [revision])

  const vigente = resultado.revision === revision
  return {
    resumen: resultado.resumen,
    cargando: !vigente && resultado.resumen === null,
    error: vigente ? resultado.error : null,
    recargar,
  }
}
