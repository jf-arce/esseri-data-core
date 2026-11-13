import { useEffect, useState } from 'react'
import { getHorarioFamilia } from '@/modules/academico/services/horario-familia'
import type { MateriaCurso } from '@/modules/academico/types'

type ResultadoHorario = {
  alumnoId: string
  materiasCurso: MateriaCurso[]
  error: boolean
}

type EstadoHorarioFamilia = {
  materiasCurso: MateriaCurso[]
  cargando: boolean
  error: boolean
}

/** Carga el horario del alumno seleccionado. Sin alumno no pide nada y queda vacío. */
export function useHorarioFamilia(alumnoId: string | null): EstadoHorarioFamilia {
  // Se guarda junto al alumno que lo originó: así el estado "cargando" se deriva de que el
  // resultado todavía no corresponde al alumno actual, sin setState sincrónico en el efecto.
  const [resultado, setResultado] = useState<ResultadoHorario | null>(null)

  useEffect(() => {
    if (!alumnoId) return
    const controller = new AbortController()

    getHorarioFamilia(alumnoId, controller.signal)
      .then((materiasCurso) => setResultado({ alumnoId, materiasCurso, error: false }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setResultado({ alumnoId, materiasCurso: [], error: true })
      })

    return () => controller.abort()
  }, [alumnoId])

  if (!alumnoId) return { materiasCurso: [], cargando: false, error: false }
  if (!resultado || resultado.alumnoId !== alumnoId) {
    return { materiasCurso: [], cargando: true, error: false }
  }
  return { materiasCurso: resultado.materiasCurso, cargando: false, error: resultado.error }
}
