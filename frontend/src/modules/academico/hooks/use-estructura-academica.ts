import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarNiveles } from '@/modules/academico/services/niveles-educativos'
import { listarAnios } from '@/modules/academico/services/anios'
import { listarDivisiones } from '@/modules/academico/services/divisiones'
import { listarMaterias } from '@/modules/academico/services/materias'
import { listarMateriasCurso } from '@/modules/academico/services/materias-curso'
import { listarAsignaciones } from '@/modules/academico/services/asignaciones-docentes'
import { listarDocentes } from '@/modules/academico/services/docentes'
import type {
  Anio,
  Division,
  Materia,
  MateriaCurso,
  NivelEducativo,
} from '@/modules/academico/types'

/** Materia-curso con los nombres de sus docentes ya resueltos para mostrar en la tarjeta. */
export type MateriaCursoConDocentes = MateriaCurso & {
  docentes: string[]
}

export type DivisionConMaterias = Division & {
  /** Materias del catálogo asignadas a esta división, con su horario y docentes. */
  materias: MateriaCursoConDocentes[]
}

export type AnioConDivisiones = Anio & {
  divisiones: DivisionConMaterias[]
}

export type NivelConEstructura = NivelEducativo & {
  anios: AnioConDivisiones[]
}

export function useEstructuraAcademica() {
  const [datos, setDatos] = useState<NivelConEstructura[]>([])
  const [catalogo, setCatalogo] = useState<Materia[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sinPermiso, setSinPermiso] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      // Las asignaciones y los docentes son datos secundarios para el detalle de la tarjeta:
      // si fallan, la estructura se muestra igual, solo sin nombres de docentes.
      const [niveles, materias, asignaciones, docentes] = await Promise.all([
        listarNiveles(),
        listarMaterias(),
        listarAsignaciones().catch(() => []),
        listarDocentes().catch(() => []),
      ])

      const docentePorId = new Map(docentes.map((docente) => [docente.id, docente]))
      const docentesPorMateriaCurso = new Map<string, string[]>()
      for (const asignacion of asignaciones) {
        const docente = docentePorId.get(asignacion.docente_id)
        if (!docente) continue
        const nombre =
          [docente.apellido, docente.nombre].filter(Boolean).join(', ') || docente.legajo
        const nombres = docentesPorMateriaCurso.get(asignacion.materia_curso_id) ?? []
        if (!nombres.includes(nombre)) nombres.push(nombre)
        docentesPorMateriaCurso.set(asignacion.materia_curso_id, nombres)
      }

      const nivelesConEstructura: NivelConEstructura[] = await Promise.all(
        niveles.map(async (nivel) => {
          const anios = await listarAnios(nivel.id)

          const aniosConDivisiones = await Promise.all(
            anios.map(async (anio) => {
              const [divisiones, materiasCurso] = await Promise.all([
                listarDivisiones(anio.id),
                listarMateriasCurso({ anio_id: anio.id }),
              ])

              const divisionesConMaterias = divisiones.map((division) => ({
                ...division,
                materias: materiasCurso
                  .filter((materia) => materia.division_id === division.id)
                  .map((materia) => ({
                    ...materia,
                    docentes: docentesPorMateriaCurso.get(materia.id) ?? [],
                  })),
              }))

              return { ...anio, divisiones: divisionesConMaterias }
            }),
          )

          return { ...nivel, anios: aniosConDivisiones }
        }),
      )

      setDatos(nivelesConEstructura)
      setCatalogo(materias)
      setSinPermiso(false)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 403) {
        setSinPermiso(true)
      } else {
        setError(
          err instanceof ApiError ? err.detail : 'No se pudo cargar la estructura académica.',
        )
      }
    } finally {
      setCargando(false)
    }
  }, [])

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

  return { datos, catalogo, cargando, error, sinPermiso, recargar }
}
