import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { useAlumnosDivision } from '@/modules/academico/hooks/use-alumnos-division'
import { listarAsistencias } from '@/modules/academico/services/asistencias'
import type { Asistencia, TipoAsistencia } from '@/modules/academico/types'
import type { InscripcionListadoItem } from '@/modules/inscripciones/types'

export type AlumnoConAsistencia = InscripcionListadoItem & {
  asistencia?: Asistencia
  estadoAsistencia?: TipoAsistencia
}

export function useAsistenciaDivision(divisionId: string | null, fecha: string) {
  const roster = useAlumnosDivision(divisionId)
  const [asistencias, setAsistencias] = useState<Asistencia[]>([])
  const [cargandoAsistencias, setCargandoAsistencias] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sinPermiso, setSinPermiso] = useState(false)

  const cargarAsistencias = useCallback(() => {
    if (!divisionId) {
      setAsistencias([])
      setCargandoAsistencias(false)
      return Promise.resolve()
    }

    setCargandoAsistencias(true)
    setError(null)
    return listarAsistencias({ fecha, division_id: divisionId })
      .then((data) => {
        setAsistencias(data)
        setSinPermiso(false)
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) {
          setSinPermiso(true)
        } else {
          setError(
            err instanceof ApiError ? err.detail : 'No se pudieron cargar los datos de asistencia.',
          )
        }
      })
      .finally(() => setCargandoAsistencias(false))
  }, [divisionId, fecha])

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      await cargarAsistencias()
      if (cancelado) return
    })()
    return () => {
      cancelado = true
    }
  }, [cargarAsistencias])

  // Combinar el roster de la división con la asistencia registrada para esta fecha puntual.
  const asistenciaPorInscripcion = new Map(asistencias.map((a) => [a.inscripcion_id, a]))
  const alumnos: AlumnoConAsistencia[] = roster.alumnos.map((inscripcion) => {
    const asistencia = asistenciaPorInscripcion.get(inscripcion.id)
    return { ...inscripcion, asistencia, estadoAsistencia: asistencia?.tipo }
  })

  return {
    alumnos,
    cargando: roster.cargando || cargandoAsistencias,
    error: roster.error ?? error,
    sinPermiso: roster.sinPermiso || sinPermiso,
    // Recarga solo la asistencia: el roster no cambia al guardar/editar registros de un día.
    recargar: cargarAsistencias,
  }
}
