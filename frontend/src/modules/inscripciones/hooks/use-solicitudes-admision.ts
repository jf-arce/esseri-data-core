import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarSolicitudesAdmision } from '@/modules/inscripciones/services/solicitudes-admision'
import type {
  FiltrosSolicitudesAdmision,
  SolicitudesAdmisionListado,
} from '@/modules/inscripciones/types'

const LISTADO_VACIO: SolicitudesAdmisionListado = {
  items: [],
  total: 0,
  pagina: 1,
  tamanio_pagina: 10,
  total_paginas: 0,
}

export function useSolicitudesAdmision(filtros: FiltrosSolicitudesAdmision) {
  const [revision, setRevision] = useState(0)
  const [resultado, setResultado] = useState<{
    clave: string | null
    datos: SolicitudesAdmisionListado
    error: string | null
    sinPermiso: boolean
  }>({ clave: null, datos: LISTADO_VACIO, error: null, sinPermiso: false })
  const { buscar, estado, etapa, pagina, tamanioPagina } = filtros
  const claveSolicitud = JSON.stringify([buscar, estado, etapa, pagina, tamanioPagina, revision])
  const recargar = useCallback(() => setRevision((actual) => actual + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    listarSolicitudesAdmision({ buscar, estado, etapa, pagina, tamanioPagina }, controller.signal)
      .then((datos) =>
        setResultado({ clave: claveSolicitud, datos, error: null, sinPermiso: false }),
      )
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        const sinPermiso = error instanceof ApiError && error.status === 403
        setResultado((actual) => ({
          clave: claveSolicitud,
          datos: actual.datos,
          error: sinPermiso
            ? null
            : error instanceof ApiError
              ? error.detail
              : 'No se pudieron cargar las solicitudes de admisión.',
          sinPermiso,
        }))
      })
    return () => controller.abort()
  }, [buscar, claveSolicitud, estado, etapa, pagina, tamanioPagina])

  const solicitudVigente = resultado.clave === claveSolicitud
  return {
    datos: resultado.datos,
    cargando: !solicitudVigente,
    error: solicitudVigente ? resultado.error : null,
    sinPermiso: solicitudVigente && resultado.sinPermiso,
    recargar,
  }
}
