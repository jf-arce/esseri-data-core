import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { confirmarRespuestaDebitos } from '@/modules/facturacion/services/confirmar-respuesta-debitos'
import { descargarArchivoDebitos } from '@/modules/facturacion/services/descargar-archivo-debitos'
import { descargarIncidenciasDebitos } from '@/modules/facturacion/services/descargar-incidencias-debitos'
import { obtenerImportacionDebitos } from '@/modules/facturacion/services/obtener-importacion-debitos'
import { previsualizarRespuestaDebitos } from '@/modules/facturacion/services/previsualizar-respuesta-debitos'
import type { FiltrosImportacionDebitos, ImportacionDebitosRead } from '@/modules/facturacion/types'

interface UseImportacionDebitosParams {
  importacionId: string | null
  filtros: FiltrosImportacionDebitos
}

export function useImportacionDebitos({ importacionId, filtros }: UseImportacionDebitosParams) {
  const { resultado, buscar, pagina, tamanio } = filtros
  const [revision, setRevision] = useState(0)
  const [datos, setDatos] = useState<{
    clave: string | null
    importacion: ImportacionDebitosRead | null
    error: string | null
  }>({ clave: null, importacion: null, error: null })
  const [procesando, setProcesando] = useState(false)
  const clave = importacionId
    ? JSON.stringify([importacionId, resultado, buscar, pagina, tamanio, revision])
    : null
  const recargar = useCallback(() => setRevision((actual) => actual + 1), [])

  useEffect(() => {
    if (!importacionId) return
    const controller = new AbortController()
    obtenerImportacionDebitos(
      importacionId,
      { resultado, buscar, pagina, tamanio },
      controller.signal,
    )
      .then((importacion) => setDatos({ clave, importacion, error: null }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setDatos((actual) => ({
          clave,
          importacion: actual.clave === clave ? actual.importacion : null,
          error:
            error instanceof ApiError
              ? (error.detail ?? 'No se pudo cargar la importación.')
              : error instanceof Error
                ? error.message
                : 'No se pudo cargar la importación.',
        }))
      })
    return () => controller.abort()
  }, [buscar, clave, importacionId, pagina, resultado, tamanio])

  async function previsualizar(contenido: string) {
    setProcesando(true)
    try {
      return await previsualizarRespuestaDebitos(contenido)
    } finally {
      setProcesando(false)
    }
  }

  async function confirmar(id: string) {
    setProcesando(true)
    try {
      const importacion = await confirmarRespuestaDebitos(id)
      setDatos({ clave, importacion, error: null })
      return importacion
    } finally {
      setProcesando(false)
    }
  }

  async function descargarIncidencias(id: string) {
    const archivo = await descargarIncidenciasDebitos(id)
    descargarArchivoDebitos(archivo)
  }

  const vigente = datos.clave === clave
  return {
    importacion: importacionId ? datos.importacion : null,
    cargando: Boolean(importacionId) && !vigente,
    error: importacionId && vigente ? datos.error : null,
    procesando,
    recargar,
    previsualizar,
    confirmar,
    descargarIncidencias,
  }
}
