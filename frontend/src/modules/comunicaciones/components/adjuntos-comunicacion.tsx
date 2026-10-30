import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { analizarAdjunto } from '../services/adjuntos'
import { descargarAdjunto } from '../services/descargar-adjunto'
import type { Adjunto } from '../types'
import { ETIQUETAS_ESTADO_ADJUNTO, badgeEstadoAdjunto, formatearTamanio } from '../utils'

interface Props {
  comunicacionId: string
  adjuntos: Adjunto[]
  familia?: boolean
  docente?: boolean
  onActualizar?: (adjunto: Adjunto) => void
}

/** Lista de archivos de una comunicación. La familia solo ve los que ya están limpios. */
export function AdjuntosComunicacion({
  comunicacionId,
  adjuntos,
  familia = false,
  docente = false,
  onActualizar,
}: Props) {
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const visibles = familia ? adjuntos.filter((adjunto) => adjunto.estado === 'limpio') : adjuntos

  async function descargar(adjunto: Adjunto) {
    setError('')
    setOcupado(adjunto.id)
    try {
      await descargarAdjunto(comunicacionId, adjunto, { familia, docente })
    } catch {
      setError('No se pudo descargar el archivo. Volvé a intentarlo.')
    } finally {
      setOcupado(null)
    }
  }

  async function reintentar(adjunto: Adjunto) {
    setError('')
    setOcupado(adjunto.id)
    try {
      onActualizar?.(await analizarAdjunto(comunicacionId, adjunto.id, docente))
    } catch {
      setError('No se pudo reintentar el análisis del archivo.')
    } finally {
      setOcupado(null)
    }
  }

  if (visibles.length === 0) {
    return (
      <section className="space-y-2">
        <h2 className="font-semibold">Archivos adjuntos</h2>
        <p className="text-sm text-texto-2">
          {familia
            ? 'Esta comunicación no tiene archivos disponibles.'
            : 'No hay archivos adjuntos.'}
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-3" aria-labelledby="archivos-titulo">
      <h2 id="archivos-titulo" className="font-semibold">
        Archivos adjuntos
      </h2>
      {error && (
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <ul className="divide-y divide-borde">
        {visibles.map((adjunto) => (
          <li key={adjunto.id} className="flex flex-wrap items-center gap-3 py-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{adjunto.nombre}</span>
              <span className="text-xs text-texto-2">{formatearTamanio(adjunto.tamanio)}</span>
            </span>
            {!familia && (
              <Badge variant={badgeEstadoAdjunto(adjunto.estado)}>
                {ETIQUETAS_ESTADO_ADJUNTO[adjunto.estado]}
              </Badge>
            )}
            {!familia && (adjunto.estado === 'cuarentena' || adjunto.estado === 'error') && (
              <Button
                variant="secondary"
                size="sm"
                disabled={ocupado !== null}
                onClick={() => void reintentar(adjunto)}
              >
                Reintentar análisis
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              disabled={ocupado !== null || adjunto.estado !== 'limpio'}
              onClick={() => void descargar(adjunto)}
            >
              Descargar {adjunto.nombre}
            </Button>
          </li>
        ))}
      </ul>
      {!familia && visibles.some((adjunto) => adjunto.estado !== 'limpio') && (
        <p className="text-sm text-texto-2">
          Solo los archivos limpios se pueden descargar y habilitan la publicación.
        </p>
      )}
    </section>
  )
}
