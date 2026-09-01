import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarAsistencias } from '@/modules/academico/services/asistencias'
import { listarInscripciones } from '@/modules/inscripciones/services/listar-inscripciones'
import type { InscripcionListadoItem } from '@/modules/inscripciones/types'
import type { Asistencia, TipoAsistencia } from '@/modules/academico/types'

export type AlumnoConAsistencia = InscripcionListadoItem & {
  asistencia?: Asistencia
  estadoAsistencia?: TipoAsistencia
}

export function useAsistenciaDivision(divisionId: string | null, fecha: string) {
  const [alumnos, setAlumnos] = useState<AlumnoConAsistencia[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sinPermiso, setSinPermiso] = useState(false)

  const cargar = useCallback(async () => {
    if (!divisionId) {
      setAlumnos([])
      setCargando(false)
      return
    }

    setCargando(true)
    setError(null)
    try {
      // Cargar inscripciones activas de la división
      const inscripcionesResponse = await listarInscripciones({
        pagina: 1,
        tamanioPagina: 100, // Límite razonable para una división
      })

      const inscripcionesDeDivision = inscripcionesResponse.items.filter(
        (insc) => insc.division_id === divisionId && insc.estado === 'activa',
      )

      // Cargar asistencias para la fecha y división
      const asistencias = await listarAsistencias({
        fecha,
        division_id: divisionId,
      })

      // Crear mapa de asistencia por inscripción_id
      const asistenciaMap = new Map(asistencias.map((a) => [a.inscripcion_id, a]))

      // Combinar datos
      const alumnosConAsistencia: AlumnoConAsistencia[] = inscripcionesDeDivision.map(
        (inscripcion) => {
          const asistencia = asistenciaMap.get(inscripcion.id)
          return {
            ...inscripcion,
            asistencia,
            estadoAsistencia: asistencia?.tipo,
          }
        },
      )

      setAlumnos(alumnosConAsistencia)
      setSinPermiso(false)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 403) {
        setSinPermiso(true)
      } else {
        setError(
          err instanceof ApiError ? err.detail : 'No se pudieron cargar los datos de asistencia.',
        )
      }
    } finally {
      setCargando(false)
    }
  }, [divisionId, fecha])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await cargar()
      if (cancelled) return
    })()
    return () => {
      cancelled = true
    }
  }, [cargar])

  const recargar = useCallback(() => {
    return cargar()
  }, [cargar])

  return { alumnos, cargando, error, sinPermiso, recargar }
}
