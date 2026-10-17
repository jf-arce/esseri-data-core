import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarTareas } from '@/modules/workflows/services/listar-tareas'
import type { FiltrosTareas, TareaListado } from '@/modules/workflows/types'

const LISTADO_VACIO: TareaListado = {
  items: [],
  total: 0,
  pagina: 1,
  tamanio_pagina: 20,
  total_paginas: 0,
}

export function useTareas(filtros: FiltrosTareas) {
  const [revision, setRevision] = useState(0)
  const [resultado, setResultado] = useState<{
    clave: string | null
    datos: TareaListado
    error: string | null
  }>({ clave: null, datos: LISTADO_VACIO, error: null })

  const { estado, prioridad, soloMias, pagina, tamanioPagina } = filtros
  const claveSolicitud = JSON.stringify([
    estado,
    prioridad,
    soloMias,
    pagina,
    tamanioPagina,
    revision,
  ])

  const recargar = useCallback(() => setRevision((actual) => actual + 1), [])

  useEffect(() => {
    const controller = new AbortController()

    listarTareas({ estado, prioridad, soloMias, pagina, tamanioPagina }, controller.signal)
      .then((datos) => {
        setResultado({ clave: claveSolicitud, datos, error: null })
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setResultado((actual) => ({
          clave: claveSolicitud,
          datos: actual.datos,
          error: err instanceof ApiError ? err.detail : 'No se pudieron cargar las tareas.',
        }))
      })

    return () => controller.abort()
  }, [claveSolicitud, estado, prioridad, soloMias, pagina, tamanioPagina])

  const solicitudVigente = resultado.clave === claveSolicitud

  return {
    datos: resultado.datos,
    cargando: !solicitudVigente,
    error: solicitudVigente ? resultado.error : null,
    recargar,
  }
}
