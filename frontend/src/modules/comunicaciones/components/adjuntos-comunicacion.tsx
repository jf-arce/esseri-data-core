import { useEffect, useRef, useState } from 'react'
import { FileImageIcon, FileTextIcon, MinusIcon, PlusIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { analizarAdjunto } from '../services/adjuntos'
import { descargarAdjunto, obtenerArchivoAdjunto } from '../services/descargar-adjunto'
import type { Adjunto } from '../types'
import { ETIQUETAS_ESTADO_ADJUNTO, badgeEstadoAdjunto, formatearTamanio } from '../utils'

interface Props {
  comunicacionId: string
  adjuntos: Adjunto[]
  familia?: boolean
  docente?: boolean
  onActualizar?: (adjunto: Adjunto) => void
}

/** Lista de archivos de una comunicación. La familia solo ve los que ya están verificados. */
export function AdjuntosComunicacion({
  comunicacionId,
  adjuntos,
  familia = false,
  docente = false,
  onActualizar,
}: Props) {
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [vistaPrevia, setVistaPrevia] = useState<Adjunto | null>(null)
  const [archivo, setArchivo] = useState<{ url: string; tipo: string } | null>(null)
  const [errorVista, setErrorVista] = useState('')
  const [revision, setRevision] = useState(0)
  const [zoom, setZoom] = useState(100)
  const disparador = useRef<HTMLButtonElement | null>(null)
  const visibles = familia ? adjuntos.filter((adjunto) => adjunto.estado === 'limpio') : adjuntos
  const disponibles = visibles.filter((adjunto) => adjunto.estado === 'limpio')

  useEffect(() => {
    if (!vistaPrevia || vistaPrevia.estado !== 'limpio') return
    const controller = new AbortController()
    let url: string | undefined
    obtenerArchivoAdjunto(comunicacionId, vistaPrevia, {
      familia,
      docente,
      signal: controller.signal,
    })
      .then((blob) => {
        if (controller.signal.aborted) return
        if (
          !['application/pdf', 'image/jpeg', 'image/png'].includes(blob.type) ||
          blob.type !== vistaPrevia.tipo_contenido
        )
          throw new Error('Unsupported preview type')
        url = URL.createObjectURL(blob)
        setArchivo({ url, tipo: blob.type })
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setErrorVista('No se pudo abrir el archivo. Volvé a intentarlo.')
      })
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [comunicacionId, vistaPrevia, familia, docente, revision])

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
      <div className="flex flex-col gap-3 rounded-lg border border-borde p-3 sm:flex-row sm:items-center">
        <ul className="min-w-0 flex-1 divide-y divide-borde">
          {visibles.map((adjunto) => (
            <li key={adjunto.id} className="flex flex-wrap items-center gap-3 py-2">
              <span
                aria-hidden
                className={`flex size-10 shrink-0 items-center justify-center rounded-lg border border-borde ${adjunto.tipo_contenido === 'application/pdf' ? 'text-error' : 'text-info'}`}
              >
                {adjunto.tipo_contenido === 'application/pdf' ? (
                  <FileTextIcon className="size-5" />
                ) : (
                  <FileImageIcon className="size-5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span title={adjunto.nombre} className="block truncate text-sm font-semibold">
                  {adjunto.nombre}
                </span>
                <span className="text-xs text-texto-2">
                  {adjunto.tipo_contenido === 'application/pdf'
                    ? 'PDF'
                    : adjunto.tipo_contenido === 'image/png'
                      ? 'PNG'
                      : 'JPG'}{' '}
                  · {formatearTamanio(adjunto.tamanio)}
                </span>
              </span>
              {!familia && adjunto.estado !== 'limpio' && (
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
            </li>
          ))}
        </ul>
        <Button
          className="shrink-0"
          disabled={ocupado !== null || disponibles.length === 0}
          onClick={(evento) => {
            disparador.current = evento.currentTarget
            setArchivo(null)
            setErrorVista('')
            setError('')
            setZoom(100)
            setVistaPrevia(disponibles[0])
          }}
        >
          {visibles.length === 1 ? 'Ver adjunto' : 'Ver adjuntos'}
        </Button>
      </div>
      <Dialog
        open={vistaPrevia !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setVistaPrevia(null)
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="fixed inset-0 top-0 left-0 flex h-dvh max-h-none w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 shadow-none data-open:animate-none data-closed:animate-none sm:max-w-none"
          onCloseAutoFocus={(evento) => {
            evento.preventDefault()
            disparador.current?.focus()
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borde p-4">
            <DialogHeader className="min-w-0 flex-1">
              <DialogTitle className="pr-2 leading-snug break-words">
                {vistaPrevia?.nombre}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Vista previa del archivo. Podés verlo aquí o descargarlo.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="icon"
                aria-label="Reducir zoom"
                disabled={!archivo || zoom <= 50}
                onClick={() => setZoom((valor) => Math.max(50, valor - 25))}
              >
                <MinusIcon />
              </Button>
              <output
                aria-label="Nivel de zoom"
                className="min-w-12 text-center text-sm tabular-nums"
              >
                {zoom}%
              </output>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Aumentar zoom"
                disabled={!archivo || zoom >= 200}
                onClick={() => setZoom((valor) => Math.min(200, valor + 25))}
              >
                <PlusIcon />
              </Button>
              <Button
                variant="secondary"
                disabled={ocupado !== null || !vistaPrevia}
                onClick={() => {
                  if (vistaPrevia) void descargar(vistaPrevia)
                }}
              >
                Descargar
              </Button>
              <DialogClose asChild>
                <Button>Cerrar</Button>
              </DialogClose>
            </div>
          </div>
          {disponibles.length > 1 && (
            <div className="border-b border-borde px-4 py-3">
              <Select
                value={vistaPrevia?.id}
                disabled={ocupado !== null}
                onValueChange={(id) => {
                  setArchivo(null)
                  setErrorVista('')
                  setError('')
                  setZoom(100)
                  setVistaPrevia(disponibles.find((adjunto) => adjunto.id === id) ?? null)
                }}
              >
                <SelectTrigger aria-label="Elegir adjunto" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {disponibles.map((adjunto) => (
                    <SelectItem key={adjunto.id} value={adjunto.id}>
                      {adjunto.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-auto bg-fila-hover p-4 sm:p-6">
            {error && (
              <Alert variant="error">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {errorVista ? (
              <Alert variant="error">
                <AlertDescription>
                  {errorVista}{' '}
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setErrorVista('')
                      setArchivo(null)
                      setRevision((valor) => valor + 1)
                    }}
                  >
                    Reintentar
                  </Button>
                </AlertDescription>
              </Alert>
            ) : !archivo ? (
              <Skeleton className="h-64 w-full" aria-label="Cargando vista previa" />
            ) : archivo.tipo === 'application/pdf' ? (
              <div className="flex h-full flex-col gap-3">
                <iframe
                  src={`${archivo.url}#toolbar=0&zoom=${zoom}`}
                  title={`Vista previa de ${vistaPrevia?.nombre}`}
                  className="min-h-0 w-full flex-1 rounded-lg border-0"
                />
                <p className="text-sm text-texto-2">
                  Si tu navegador no muestra el PDF, podés descargarlo.
                </p>
              </div>
            ) : (
              <div className="mx-auto" style={{ width: `${zoom}%` }}>
                <img
                  src={archivo.url}
                  alt={`Vista previa de ${vistaPrevia?.nombre}`}
                  className="h-auto w-full rounded-lg object-contain"
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {!familia && visibles.some((adjunto) => adjunto.estado !== 'limpio') && (
        <p className="text-sm text-texto-2">
          Solo los archivos con análisis completo se pueden abrir y habilitan la publicación.
        </p>
      )}
    </section>
  )
}
