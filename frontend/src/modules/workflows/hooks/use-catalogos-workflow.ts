import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarTiposAccion } from '@/modules/workflows/services/listar-tipos-accion'
import { listarTiposEvento } from '@/modules/workflows/services/listar-tipos-evento'
import type { TipoAccionCatalogo, TipoEvento } from '@/modules/workflows/types'

export function useCatalogosWorkflow() {
  const [revision, setRevision] = useState(0)
  const [resultado, setResultado] = useState<{
    revision: number | null
    tiposEvento: TipoEvento[]
    tiposAccion: TipoAccionCatalogo[]
    error: string | null
  }>({ revision: null, tiposEvento: [], tiposAccion: [], error: null })
  const recargar = useCallback(() => setRevision((actual) => actual + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([listarTiposEvento(controller.signal), listarTiposAccion(controller.signal)])
      .then(([tiposEvento, tiposAccion]) =>
        setResultado({ revision, tiposEvento, tiposAccion, error: null }),
      )
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setResultado((actual) => ({
          ...actual,
          revision,
          error: error instanceof ApiError ? error.detail : 'No se pudieron cargar los catálogos.',
        }))
      })
    return () => controller.abort()
  }, [revision])

  const vigente = resultado.revision === revision
  return {
    tiposEvento: resultado.tiposEvento,
    tiposAccion: resultado.tiposAccion,
    cargando: !vigente,
    error: vigente ? resultado.error : null,
    recargar,
  }
}
