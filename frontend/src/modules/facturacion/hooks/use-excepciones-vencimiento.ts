import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarExcepcionesVencimiento } from '@/modules/facturacion/services/listar-excepciones-vencimiento'
import type { ExcepcionVencimiento } from '@/modules/facturacion/types'

export function useExcepcionesVencimiento(familiaId: string) {
  const [revision, setRevision] = useState(0)
  const [resultado, setResultado] = useState<{
    clave: string | null
    excepciones: ExcepcionVencimiento[]
    error: string | null
  }>({ clave: null, excepciones: [], error: null })
  const recargar = useCallback(() => setRevision((actual) => actual + 1), [])
  const clave = `${familiaId}:${revision}`

  useEffect(() => {
    const controller = new AbortController()
    listarExcepcionesVencimiento(familiaId, controller.signal)
      .then((excepciones) => setResultado({ clave, excepciones, error: null }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setResultado({
          clave,
          excepciones: [],
          error: error instanceof ApiError ? error.detail : 'No se pudieron cargar las prórrogas.',
        })
      })
    return () => controller.abort()
  }, [clave, familiaId])

  const vigente = resultado.clave === clave
  return {
    excepciones: vigente ? resultado.excepciones : [],
    cargando: !vigente,
    error: vigente ? resultado.error : null,
    recargar,
  }
}
