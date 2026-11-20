import { useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarEventosFamilia } from '../services/listar-eventos-familia'
import type { EventoCalendario } from '../types'

type Resultado = { clave: string; eventos: EventoCalendario[]; error: boolean }

/** Eventos publicados de la semana visible para el alumno elegido. */
export function useEventosFamilia(alumnoId: string | null, desde: string, hasta: string) {
  const clave = alumnoId ? `${alumnoId}/${desde}/${hasta}` : ''
  const [resultado, setResultado] = useState<Resultado | null>(null)

  useEffect(() => {
    if (!alumnoId) return
    const controller = new AbortController()
    listarEventosFamilia(alumnoId, desde, hasta, controller.signal)
      .then((eventos) => {
        if (!controller.signal.aborted) setResultado({ clave, eventos, error: false })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setResultado({
          clave,
          eventos: [],
          error: !(error instanceof ApiError && error.status === 403),
        })
      })
    return () => controller.abort()
  }, [alumnoId, desde, hasta, clave])

  const actual = resultado?.clave === clave ? resultado : null
  return {
    eventos: actual?.eventos ?? [],
    cargando: Boolean(alumnoId) && actual === null,
    error: actual?.error ?? false,
  }
}
