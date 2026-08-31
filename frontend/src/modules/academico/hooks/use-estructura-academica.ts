import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarNiveles } from '@/modules/academico/services/niveles-educativos'
import { listarAnios } from '@/modules/academico/services/anios'
import { listarDivisiones } from '@/modules/academico/services/divisiones'
import { listarMaterias } from '@/modules/academico/services/materias'
import type { Anio, Division, Materia, NivelEducativo } from '@/modules/academico/types'

export type NivelConEstructura = NivelEducativo & {
  anios: (Anio & {
    divisiones: (Division & {
      materias: Materia[]
    })[]
  })[]
}

export function useEstructuraAcademica() {
  const [datos, setDatos] = useState<NivelConEstructura[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sinPermiso, setSinPermiso] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const niveles = await listarNiveles()

      const nivelesConEstructura: NivelConEstructura[] = await Promise.all(
        niveles.map(async (nivel) => {
          const anios = await listarAnios(nivel.id)

          const aniosConDivisiones = await Promise.all(
            anios.map(async (anio) => {
              const [divisiones, materias] = await Promise.all([
                listarDivisiones(anio.id),
                listarMaterias(anio.id),
              ])

              const divisionesConMaterias = divisiones.map((division) => ({
                ...division,
                materias: materias.filter(
                  (m) => m.division_id === division.id || m.division_id === null,
                ),
              }))

              return { ...anio, divisiones: divisionesConMaterias }
            }),
          )

          return { ...nivel, anios: aniosConDivisiones }
        }),
      )

      setDatos(nivelesConEstructura)
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

  return { datos, cargando, error, sinPermiso, recargar }
}
