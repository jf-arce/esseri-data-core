import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarNiveles } from '@/modules/academico/services/niveles-educativos'
import { listarAnios } from '@/modules/academico/services/anios'
import { listarDivisiones } from '@/modules/academico/services/divisiones'
import { listarMaterias } from '@/modules/academico/services/materias'
import { listarMateriasCurso } from '@/modules/academico/services/materias-curso'
import type {
  Anio,
  Division,
  Materia,
  MateriaCurso,
  NivelEducativo,
} from '@/modules/academico/types'

export type NivelConEstructura = NivelEducativo & {
  anios: (Anio & {
    divisiones: (Division & {
      /** Materias del catálogo asignadas a esta división, con su horario. */
      materias: MateriaCurso[]
    })[]
  })[]
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
      const [niveles, materias] = await Promise.all([listarNiveles(), listarMaterias()])

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
                materias: materiasCurso.filter((materia) => materia.division_id === division.id),
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
