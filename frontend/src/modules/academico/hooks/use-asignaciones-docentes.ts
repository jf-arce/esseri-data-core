import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import {
  listarAsignaciones,
  type FiltrosAsignacion,
} from '@/modules/academico/services/asignaciones-docentes'
import { listarDocentes } from '@/modules/academico/services/docentes'
import { listarMaterias } from '@/modules/academico/services/materias'
import { listarDivisiones } from '@/modules/academico/services/divisiones'
import type { AsignacionDocente, Division, Docente, Materia } from '@/modules/academico/types'

export type AsignacionConNombres = AsignacionDocente & {
  docente_nombre: string
  docente_apellido: string
  materia_nombre: string
  division_nombre: string
}

export function useAsignacionesDocentes(filtros?: FiltrosAsignacion) {
  const [asignaciones, setAsignaciones] = useState<AsignacionConNombres[]>([])
  const [docentes, setDocentes] = useState<Docente[]>([])
  const [materias, setMaterias] = useState<Materia[]>([])
  const [divisiones, setDivisiones] = useState<Division[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sinPermiso, setSinPermiso] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const [asigs, docs, mats, divs] = await Promise.all([
        listarAsignaciones(filtros),
        listarDocentes(),
        listarMaterias(),
        listarDivisiones(),
      ])

      const docenteMap = new Map(docs.map((d) => [d.id, d]))
      const materiaMap = new Map(mats.map((m) => [m.id, m]))
      const divisionMap = new Map(divs.map((d) => [d.id, d]))

      const enriquecidas: AsignacionConNombres[] = asigs.map((a) => {
        const docente = docenteMap.get(a.docente_id)
        const materia = materiaMap.get(a.materia_id)
        const division = divisionMap.get(a.division_id)
        return {
          ...a,
          docente_nombre: docente?.legajo ?? '—',
          docente_apellido: '',
          materia_nombre: materia?.nombre ?? '—',
          division_nombre: division?.nombre ?? '—',
        }
      })

      setAsignaciones(enriquecidas)
      setDocentes(docs)
      setMaterias(mats)
      setDivisiones(divs)
      setSinPermiso(false)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 403) {
        setSinPermiso(true)
      } else {
        setError(err instanceof ApiError ? err.detail : 'No se pudieron cargar las asignaciones.')
      }
    } finally {
      setCargando(false)
    }
  }, [filtros])

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

  return { asignaciones, docentes, materias, divisiones, cargando, error, sinPermiso, recargar }
}
