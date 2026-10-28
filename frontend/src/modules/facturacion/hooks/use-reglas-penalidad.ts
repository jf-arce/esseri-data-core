import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarReglasPenalidad } from '@/modules/facturacion/services/listar-reglas-penalidad'
import type { ReglaPenalidad } from '@/modules/facturacion/types'

export function useReglasPenalidad() {
  const [revision, setRevision] = useState(0)
  const [resultado, setResultado] = useState<{
    revision: number | null
    reglas: ReglaPenalidad[]
    error: string | null
    sinPermiso: boolean
  }>({ revision: null, reglas: [], error: null, sinPermiso: false })
  const recargar = useCallback(() => setRevision((actual) => actual + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    listarReglasPenalidad(controller.signal)
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
              : 'No se pudieron cargar los tramos de penalidad.',
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
