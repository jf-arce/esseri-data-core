import { useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { obtenerResumenInscripciones } from '@/modules/inscripciones/services/obtener-resumen-inscripciones'
import type { ResumenInscripciones } from '@/modules/inscripciones/types'

const resumenVacio = (cicloLectivo: string): ResumenInscripciones => ({
  ciclo_lectivo: cicloLectivo,
  inscripciones_activas: 0,
  nuevas: 0,
  reinscripciones: 0,
  bajas: 0,
})

export function useResumenInscripciones(cicloLectivo: string) {
  const [resultado, setResultado] = useState<{
    cicloLectivo: string | null
    datos: ResumenInscripciones
    error: string | null
  }>({ cicloLectivo: null, datos: resumenVacio(cicloLectivo), error: null })

  useEffect(() => {
    const controller = new AbortController()

    obtenerResumenInscripciones(cicloLectivo, controller.signal)
      .then((datos) => setResultado({ cicloLectivo, datos, error: null }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setResultado((actual) => ({
          cicloLectivo,
          datos:
            actual.datos.ciclo_lectivo === cicloLectivo ? actual.datos : resumenVacio(cicloLectivo),
          error:
            error instanceof ApiError
              ? error.detail
              : 'No se pudo cargar el resumen de inscripciones.',
        }))
      })

    return () => controller.abort()
  }, [cicloLectivo])

  const vigente = resultado.cicloLectivo === cicloLectivo

  return {
    datos: resultado.datos,
    cargando: !vigente,
    error: vigente ? resultado.error : null,
  }
}
