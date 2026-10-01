import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarReglasWorkflow } from '@/modules/workflows/services/listar-reglas-workflow'
import type { ReglaWorkflow } from '@/modules/workflows/types'

export function useReglasWorkflow() {
  const [revision, setRevision] = useState(0)
  const [resultado, setResultado] = useState<{
    revision: number | null
    reglas: ReglaWorkflow[]
    error: string | null
    sinPermiso: boolean
  }>({ revision: null, reglas: [], error: null, sinPermiso: false })
  const recargar = useCallback(() => setRevision((actual) => actual + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    listarReglasWorkflow(controller.signal)
      .then((reglas) => setResultado({ revision, reglas, error: null, sinPermiso: false }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        const sinPermiso = error instanceof ApiError && error.status === 403
        setResultado((actual) => ({
          ...actual,
          revision,
          error: sinPermiso
            ? null
            : error instanceof ApiError
              ? error.detail
              : 'No se pudieron cargar las reglas.',
          sinPermiso,
        }))
      })
    return () => controller.abort()
  }, [revision])

  const vigente = resultado.revision === revision
  return {
    reglas: resultado.reglas,
    cargando: !vigente,
    error: vigente ? resultado.error : null,
    sinPermiso: vigente && resultado.sinPermiso,
    recargar,
  }
}
