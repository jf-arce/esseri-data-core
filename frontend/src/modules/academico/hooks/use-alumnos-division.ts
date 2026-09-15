import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarInscripciones } from '@/modules/inscripciones/services/listar-inscripciones'
import type { InscripcionListadoItem } from '@/modules/inscripciones/types'

// Compartido por "Tomar asistencia" e "Historial de asistencia": el roster de inscripciones
// activas de una división. `listarInscripciones` no filtra por división en el backend (el
// filtro real es a nivel de asistencia, vía `verificar_acceso_a_division`), así que se trae
// una página razonable y se filtra acá.
export function useAlumnosDivision(divisionId: string | null) {
  const [alumnos, setAlumnos] = useState<InscripcionListadoItem[]>([])
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
      const respuesta = await listarInscripciones({ pagina: 1, tamanioPagina: 100 })
      const delaDivision = respuesta.items.filter(
        (insc) => insc.division_id === divisionId && insc.estado === 'activa',
      )
      setAlumnos(delaDivision)
      setSinPermiso(false)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 403) {
        setSinPermiso(true)
      } else {
        setError(err instanceof ApiError ? err.detail : 'No se pudieron cargar los alumnos.')
      }
    } finally {
      setCargando(false)
    }
  }, [divisionId])

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      await cargar()
      if (cancelado) return
    })()
    return () => {
      cancelado = true
    }
  }, [cargar])

  return { alumnos, cargando, error, sinPermiso }
}
