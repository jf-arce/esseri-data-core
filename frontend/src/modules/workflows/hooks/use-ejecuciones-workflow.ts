import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarEjecucionesWorkflow } from '@/modules/workflows/services/listar-ejecuciones-workflow'
import type { EjecucionWorkflowListado, FiltrosEjecuciones } from '@/modules/workflows/types'

const LISTADO_VACIO: EjecucionWorkflowListado = {
  items: [],
  total: 0,
  pagina: 1,
  tamanio_pagina: 20,
  total_paginas: 0,
}

export function useEjecucionesWorkflow(filtros: FiltrosEjecuciones) {
  const [revision, setRevision] = useState(0)
  const [resultado, setResultado] = useState<{
    clave: string | null
    datos: EjecucionWorkflowListado
    error: string | null
    sinPermiso: boolean
  }>({ clave: null, datos: LISTADO_VACIO, error: null, sinPermiso: false })

  const { estado, pagina, tamanioPagina } = filtros
  const claveSolicitud = JSON.stringify([estado, pagina, tamanioPagina, revision])

  const recargar = useCallback(() => setRevision((actual) => actual + 1), [])

  useEffect(() => {
    const controller = new AbortController()

    listarEjecucionesWorkflow({ estado, pagina, tamanioPagina }, controller.signal)
      .then((datos) => {
        setResultado({ clave: claveSolicitud, datos, error: null, sinPermiso: false })
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        const sinPermiso = err instanceof ApiError && err.status === 403
        setResultado((actual) => ({
          clave: claveSolicitud,
          datos: actual.datos,
          error: sinPermiso
            ? null
            : err instanceof ApiError
              ? err.detail
              : 'No se pudo cargar el historial de ejecuciones.',
          sinPermiso,
        }))
      })

    return () => controller.abort()
  }, [claveSolicitud, estado, pagina, tamanioPagina])

  const solicitudVigente = resultado.clave === claveSolicitud

  return {
    datos: resultado.datos,
    cargando: !solicitudVigente,
    error: solicitudVigente ? resultado.error : null,
    sinPermiso: solicitudVigente && resultado.sinPermiso,
    recargar,
  }
}
