import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarPlantillas } from '@/modules/workflows/services/listar-plantillas'
import type { PlantillaNotificacion } from '@/modules/workflows/types'

/** Plantillas compatibles con el evento. Sin evento no pide nada. `cargando` y `error` solo
 * valen para el evento actual: una respuesta vieja no pisa a la del evento que se eligió después. */
export function usePlantillas(tipoEventoId: string) {
  const [revision, setRevision] = useState(0)
  const [resultado, setResultado] = useState<{
    tipoEventoId: string | null
    revision: number
    plantillas: PlantillaNotificacion[]
    error: string | null
  }>({ tipoEventoId: null, revision: 0, plantillas: [], error: null })
  const recargar = useCallback(() => setRevision((actual) => actual + 1), [])

  useEffect(() => {
    if (tipoEventoId === '') return
    const controller = new AbortController()
    listarPlantillas(tipoEventoId, controller.signal)
      .then((plantillas) => setResultado({ tipoEventoId, revision, plantillas, error: null }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setResultado({
          tipoEventoId,
          revision,
          plantillas: [],
          error: error instanceof ApiError ? error.detail : 'No se pudieron cargar las plantillas.',
        })
      })
    return () => controller.abort()
  }, [tipoEventoId, revision])

  const vigente =
    tipoEventoId === '' ||
    (resultado.tipoEventoId === tipoEventoId && resultado.revision === revision)
  return {
    plantillas: vigente && tipoEventoId !== '' ? resultado.plantillas : [],
    cargando: !vigente,
    error: vigente ? resultado.error : null,
    recargar,
  }
}
