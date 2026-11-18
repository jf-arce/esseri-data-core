import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { TAMANIO_PAGINA_AUDITORIA } from '@/modules/auditoria/constants'
import { listarAuditoria } from '@/modules/auditoria/services/listar-auditoria'
import type { AuditoriaListado, FiltrosAuditoria } from '@/modules/auditoria/types'

const LISTADO_VACIO: AuditoriaListado = {
  items: [],
  total: 0,
  pagina: 1,
  tamanio_pagina: TAMANIO_PAGINA_AUDITORIA,
  total_paginas: 0,
}

export function useAuditoria(filtros: FiltrosAuditoria) {
  const [revision, setRevision] = useState(0)
  const [resultado, setResultado] = useState<{
    clave: string | null
    datos: AuditoriaListado
    error: string | null
    sinPermiso: boolean
  }>({ clave: null, datos: LISTADO_VACIO, error: null, sinPermiso: false })

  const {
    busqueda,
    entidad,
    campo,
    usuarioId,
    actorTipo,
    origen,
    desde,
    hasta,
    orden,
    pagina,
    tamanioPagina,
  } = filtros
  const claveSolicitud = JSON.stringify([
    busqueda,
    entidad,
    campo,
    usuarioId,
    actorTipo,
    origen,
    desde,
    hasta,
    orden,
    pagina,
    tamanioPagina,
    revision,
  ])

  const recargar = useCallback(() => setRevision((actual) => actual + 1), [])

  useEffect(() => {
    const controller = new AbortController()

    listarAuditoria(
      {
        busqueda,
        entidad,
        campo,
        usuarioId,
        actorTipo,
        origen,
        desde,
        hasta,
        orden,
        pagina,
        tamanioPagina,
      },
      controller.signal,
    )
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
              : 'No se pudo cargar la auditoría.',
          sinPermiso,
        }))
      })

    return () => controller.abort()
  }, [
    busqueda,
    entidad,
    campo,
    usuarioId,
    actorTipo,
    origen,
    desde,
    hasta,
    orden,
    pagina,
    tamanioPagina,
    claveSolicitud,
  ])

  const solicitudVigente = resultado.clave === claveSolicitud

  return {
    datos: resultado.datos,
    cargando: !solicitudVigente,
    error: solicitudVigente ? resultado.error : null,
    sinPermiso: solicitudVigente && resultado.sinPermiso,
    recargar,
  }
}
