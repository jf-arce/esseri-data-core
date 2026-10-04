import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarNotificaciones } from '@/modules/workflows/services/listar-notificaciones'
import type { FiltrosNotificaciones, NotificacionEnviadaListado } from '@/modules/workflows/types'

const LISTADO_VACIO: NotificacionEnviadaListado = {
  items: [],
  total: 0,
  pagina: 1,
  tamanio_pagina: 20,
  total_paginas: 0,
}

export function useNotificaciones(filtros: FiltrosNotificaciones) {
  const [revision, setRevision] = useState(0)
  const [resultado, setResultado] = useState<{
    clave: string | null
    datos: NotificacionEnviadaListado
    error: string | null
    sinPermiso: boolean
  }>({ clave: null, datos: LISTADO_VACIO, error: null, sinPermiso: false })

  const { estadoEnvio, destinatarioTipo, pagina, tamanioPagina } = filtros
  const claveSolicitud = JSON.stringify([
    estadoEnvio,
    destinatarioTipo,
    pagina,
    tamanioPagina,
    revision,
  ])

  const recargar = useCallback(() => setRevision((actual) => actual + 1), [])

  useEffect(() => {
    const controller = new AbortController()

    listarNotificaciones(
      { estadoEnvio, destinatarioTipo, pagina, tamanioPagina },
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
              : 'No se pudo cargar el log de notificaciones.',
          sinPermiso,
        }))
      })

    return () => controller.abort()
  }, [claveSolicitud, estadoEnvio, destinatarioTipo, pagina, tamanioPagina])

  const solicitudVigente = resultado.clave === claveSolicitud

  return {
    datos: resultado.datos,
    cargando: !solicitudVigente,
    error: solicitudVigente ? resultado.error : null,
    sinPermiso: solicitudVigente && resultado.sinPermiso,
    recargar,
  }
}
