import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarEjecucionesFacturacion } from '@/modules/facturacion/services/listar-ejecuciones-facturacion'
import type { EjecucionFacturacion } from '@/modules/facturacion/types'

export function useEjecucionesFacturacion() {
  const [revision, setRevision] = useState(0)
  const [resultado, setResultado] = useState<{
    revision: number | null
    ejecuciones: EjecucionFacturacion[]
    error: string | null
  }>({ revision: null, ejecuciones: [], error: null })
  const recargar = useCallback(() => setRevision((actual) => actual + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    listarEjecucionesFacturacion(100, controller.signal)
      .then((ejecuciones) => setResultado({ revision, ejecuciones, error: null }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setResultado((actual) => ({
          ...actual,
          revision,
          error:
            error instanceof ApiError
              ? error.detail
              : 'No se pudo cargar el historial de ejecuciones.',
        }))
      })
    return () => controller.abort()
  }, [revision])

  const vigente = resultado.revision === revision
  return {
    ejecuciones: resultado.ejecuciones,
    cargando: !vigente,
    error: vigente ? resultado.error : null,
    recargar,
  }
}
