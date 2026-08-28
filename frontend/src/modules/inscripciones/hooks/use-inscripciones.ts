import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarInscripciones } from '@/modules/inscripciones/services/listar-inscripciones'
import type { FiltrosInscripciones, InscripcionListado } from '@/modules/inscripciones/types'

const LISTADO_VACIO: InscripcionListado = {
  items: [],
  total: 0,
  pagina: 1,
  tamanio_pagina: 10,
  total_paginas: 0,
}

export function useInscripciones(filtros: FiltrosInscripciones) {
  const [revision, setRevision] = useState(0)
  const [resultado, setResultado] = useState<{
    clave: string | null
    datos: InscripcionListado
    error: string | null
    sinPermiso: boolean
  }>({ clave: null, datos: LISTADO_VACIO, error: null, sinPermiso: false })

  const { buscar, cicloLectivo, estado, tipo, pagina, tamanioPagina } = filtros
  const claveSolicitud = JSON.stringify([
    buscar,
    cicloLectivo,
    estado,
    tipo,
    pagina,
    tamanioPagina,
    revision,
  ])

  const recargar = useCallback(() => setRevision((actual) => actual + 1), [])

  useEffect(() => {
    const controller = new AbortController()

    listarInscripciones(
      { buscar, cicloLectivo, estado, tipo, pagina, tamanioPagina },
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
              : 'No se pudieron cargar las inscripciones.',
          sinPermiso,
        }))
      })

    return () => controller.abort()
  }, [buscar, cicloLectivo, claveSolicitud, estado, pagina, tamanioPagina, tipo])

  const solicitudVigente = resultado.clave === claveSolicitud

  return {
    datos: resultado.datos,
    cargando: !solicitudVigente,
    error: solicitudVigente ? resultado.error : null,
    sinPermiso: solicitudVigente && resultado.sinPermiso,
    recargar,
  }
}
