import { useState } from 'react'
import type { FileRejection } from 'react-dropzone'
import { Dropzone } from '@/components/dropzone'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { analizarAdjunto, eliminarAdjunto, subirAdjunto } from '../services/adjuntos'
import type { Adjunto } from '../types'
import {
  AYUDA_ADJUNTOS,
  ETIQUETAS_ESTADO_ADJUNTO,
  MAX_ADJUNTOS,
  TIPOS_ADJUNTO,
  badgeEstadoAdjunto,
  formatearTamanio,
  validarAdjuntosNuevos,
} from '../utils'

interface Props {
  comunicacionId?: string
  adjuntos: Adjunto[]
  docente?: boolean
  bloqueado?: boolean
  onCambio: (adjuntos: Adjunto[]) => void
  onAviso: (mensaje: string) => void
}

/** Archivos del borrador: subir, reintentar análisis y quitar mientras siga siendo borrador. */
export function AdjuntosBorrador({
  comunicacionId,
  adjuntos,
  docente = false,
  bloqueado = false,
  onCambio,
  onAviso,
}: Props) {
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function adjuntar(archivos: File[], rechazos: FileRejection[]) {
    if (!comunicacionId) return
    if (rechazos.length > 0) {
      setError(AYUDA_ADJUNTOS)
      return
    }
    const problema = validarAdjuntosNuevos(archivos, adjuntos)
    if (problema) {
      setError(problema)
      return
    }
    setError('')
    setOcupado('subida')
    try {
      const subidos: Adjunto[] = []
      for (const archivo of archivos)
        subidos.push(await subirAdjunto(comunicacionId, archivo, docente))
      onCambio([...adjuntos, ...subidos])
      onAviso(
        subidos.length === 1
          ? 'Archivo agregado. Queda en cuarentena hasta completar el análisis.'
          : 'Archivos agregados. Quedan en cuarentena hasta completar el análisis.',
      )
    } catch {
      setError('No se pudo subir el archivo. Intentá de nuevo.')
    } finally {
      setOcupado(null)
    }
  }

  async function quitar(adjunto: Adjunto) {
    if (!comunicacionId) return
    setError('')
    setOcupado(adjunto.id)
    try {
      await eliminarAdjunto(comunicacionId, adjunto.id, docente)
      onCambio(adjuntos.filter((item) => item.id !== adjunto.id))
      onAviso('Archivo quitado.')
    } catch {
      setError('No se pudo quitar el archivo.')
    } finally {
      setOcupado(null)
    }
  }

  async function reintentar(adjunto: Adjunto) {
    if (!comunicacionId) return
    setError('')
    setOcupado(adjunto.id)
    try {
      const actualizado = await analizarAdjunto(comunicacionId, adjunto.id, docente)
      onCambio(adjuntos.map((item) => (item.id === actualizado.id ? actualizado : item)))
      onAviso('Análisis solicitado nuevamente.')
    } catch {
      setError('No se pudo reintentar el análisis del archivo.')
    } finally {
      setOcupado(null)
    }
  }

  const deshabilitado = bloqueado || ocupado !== null

  return (
    <section className="space-y-3" aria-labelledby="adjuntos-titulo">
      <div className="space-y-1">
        <h2 id="adjuntos-titulo" className="font-semibold">
          Archivos adjuntos
        </h2>
        <p className="text-sm text-texto-2">{AYUDA_ADJUNTOS}</p>
        <p className="text-sm text-texto-2">
          Cada archivo se analiza por seguridad; cuando termina, queda verificado y habilita la
          publicación.
        </p>
      </div>
      {!comunicacionId ? (
        <p role="status" className="text-sm text-texto-2">
          Guardá el borrador para adjuntar archivos.
        </p>
      ) : (
        <Dropzone
          onDrop={(archivos, rechazos) => void adjuntar(archivos, rechazos)}
          accept={TIPOS_ADJUNTO}
          maxSize={5 * 1024 * 1024}
          multiple
          disabled={deshabilitado || adjuntos.length >= MAX_ADJUNTOS}
          hint={
            adjuntos.length >= MAX_ADJUNTOS
              ? `Ya adjuntaste el máximo de ${MAX_ADJUNTOS} archivos.`
              : AYUDA_ADJUNTOS
          }
        />
      )}
      {ocupado === 'subida' && (
        <p role="status" className="text-sm text-texto-2">
          Subiendo archivos…
        </p>
      )}
      {error && (
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {adjuntos.length > 0 && (
        <ul aria-label="Archivos del borrador" className="divide-y divide-borde">
          {adjuntos.map((adjunto) => (
            <li key={adjunto.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{adjunto.nombre}</span>
                <span className="text-xs text-texto-2">{formatearTamanio(adjunto.tamanio)}</span>
              </span>
              <Badge variant={badgeEstadoAdjunto(adjunto.estado)}>
                {ETIQUETAS_ESTADO_ADJUNTO[adjunto.estado]}
              </Badge>
              {(adjunto.estado === 'cuarentena' || adjunto.estado === 'error') && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={deshabilitado}
                  onClick={() => void reintentar(adjunto)}
                >
                  Reintentar análisis
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                disabled={deshabilitado}
                onClick={() => void quitar(adjunto)}
              >
                Quitar {adjunto.nombre}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {adjuntos.some((adjunto) => adjunto.estado === 'rechazado') && (
        <p role="alert" className="text-sm text-error">
          Un archivo fue rechazado por el análisis. Quitalo para poder publicar.
        </p>
      )}
      {adjuntos.some(
        (adjunto) => adjunto.estado !== 'limpio' && adjunto.estado !== 'rechazado',
      ) && (
        <p className="text-sm text-texto-2">
          La publicación queda bloqueada hasta que todos los archivos estén verificados.
        </p>
      )}
    </section>
  )
}
