import { useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarEventosRecientes } from '@/modules/workflows/services/listar-eventos-recientes'
import type { EventoResumen } from '@/modules/workflows/types'

/** Eventos reales del tipo elegido, para probar una regla. Vacío sin `tipoEventoId`. */
export function useEventosRecientes(tipoEventoId: string) {
  const [resultado, setResultado] = useState<{
    tipoEventoId: string
    eventos: EventoResumen[]
    error: string | null
  }>({ tipoEventoId: '', eventos: [], error: null })

  useEffect(() => {
    if (tipoEventoId === '') return
    const controller = new AbortController()
    listarEventosRecientes(tipoEventoId, controller.signal)
      .then((eventos) => setResultado({ tipoEventoId, eventos, error: null }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setResultado({
          tipoEventoId,
          eventos: [],
          error:
            error instanceof ApiError
              ? error.detail
              : 'No se pudieron cargar los eventos recientes.',
        })
      })
    return () => controller.abort()
  }, [tipoEventoId])

  const vigente = tipoEventoId !== '' && resultado.tipoEventoId === tipoEventoId
  return {
    eventos: vigente ? resultado.eventos : [],
    cargando: tipoEventoId !== '' && !vigente,
    error: vigente ? resultado.error : null,
  }
}
