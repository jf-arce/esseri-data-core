import { useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { obtenerDestinatariosRegla } from '@/modules/workflows/services/obtener-destinatarios-regla'
import type { DestinatariosRegla } from '@/modules/workflows/types'

/** Destinatarios guardados de una regla para el editor. Sin `id` (alta) no pide nada. */
export function useDestinatariosRegla(id: string | undefined) {
  const [resultado, setResultado] = useState<{
    id: string | undefined
    destinatarios: DestinatariosRegla | null
    error: string | null
  }>({ id: undefined, destinatarios: null, error: null })

  useEffect(() => {
    if (id === undefined) return
    const controller = new AbortController()
    obtenerDestinatariosRegla(id, controller.signal)
      .then((destinatarios) => setResultado({ id, destinatarios, error: null }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setResultado({
          id,
          destinatarios: null,
          error:
            error instanceof ApiError ? error.detail : 'No se pudieron cargar los destinatarios.',
        })
      })
    return () => controller.abort()
  }, [id])

  const vigente = id === undefined || resultado.id === id
  return {
    destinatarios: vigente ? resultado.destinatarios : null,
    cargando: !vigente,
    error: vigente ? resultado.error : null,
  }
}
