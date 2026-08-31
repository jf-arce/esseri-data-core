import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarReglasFacturacion } from '@/modules/facturacion/services/listar-reglas-facturacion'
import type { ReglaFacturacion } from '@/modules/facturacion/types'

export function useReglasFacturacion() {
  const [revision, setRevision] = useState(0)
  const [resultado, setResultado] = useState<{
    revision: number | null
    reglas: ReglaFacturacion[]
    error: string | null
    sinPermiso: boolean
  }>({ revision: null, reglas: [], error: null, sinPermiso: false })
  const recargar = useCallback(() => setRevision((actual) => actual + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    listarReglasFacturacion(controller.signal)
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
