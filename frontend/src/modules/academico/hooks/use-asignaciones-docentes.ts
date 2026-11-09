import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import {
  listarAsignaciones,
  type FiltrosAsignacion,
} from '@/modules/academico/services/asignaciones-docentes'
import { listarDocentes } from '@/modules/academico/services/docentes'
import { listarMateriasCurso } from '@/modules/academico/services/materias-curso'
import { listarDivisiones } from '@/modules/academico/services/divisiones'
import type { AsignacionDocente, Division, Docente, MateriaCurso } from '@/modules/academico/types'

export type AsignacionConNombres = AsignacionDocente & {
  docente_nombre: string
  docente_apellido: string
  materia_nombre: string
  division_nombre: string
}

export function useAsignacionesDocentes(filtros?: FiltrosAsignacion) {
  const [asignaciones, setAsignaciones] = useState<AsignacionConNombres[]>([])
  const [docentes, setDocentes] = useState<Docente[]>([])
  const [materiasCurso, setMateriasCurso] = useState<MateriaCurso[]>([])
  const [divisiones, setDivisiones] = useState<Division[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sinPermiso, setSinPermiso] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const [asigs, docs, cursos, divs] = await Promise.all([
        listarAsignaciones(filtros),
        listarDocentes(),
        listarMateriasCurso(),
        listarDivisiones(),
      ])

      const docenteMap = new Map(docs.map((d) => [d.id, d]))

      const enriquecidas: AsignacionConNombres[] = asigs.map((a) => {
        const docente = docenteMap.get(a.docente_id)
        const nombreCompleto =
          docente?.nombre && docente?.apellido
            ? `${docente.legajo} - ${docente.nombre} ${docente.apellido}`
            : (docente?.legajo ?? '—')
        return {
          ...a,
          docente_nombre: nombreCompleto,
          docente_apellido: '',
          materia_nombre: a.materia_nombre ?? '—',
          division_nombre: a.division_nombre ?? '—',
        }
      })

      setAsignaciones(enriquecidas)
      setDocentes(docs)
      setMateriasCurso(cursos)
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

  return {
    asignaciones,
    docentes,
    materiasCurso,
    divisiones,
    cargando,
    error,
    sinPermiso,
    recargar,
  }
}
