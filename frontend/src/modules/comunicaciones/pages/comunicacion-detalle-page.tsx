import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeftIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AdjuntosComunicacion } from '../components/adjuntos-comunicacion'
import { EnviosEmail } from '../components/envios-email'
import { obtenerComunicacion } from '../services/obtener-comunicacion'
import { registrarLectura } from '../services/registrar-lectura'
import type { Adjunto, Comunicacion } from '../types'
import { ETIQUETAS_CANAL, ETIQUETAS_TIPO } from '../utils'

export function ComunicacionDetallePage({
  familia = false,
  docente = false,
}: {
  familia?: boolean
  docente?: boolean
}) {
  const { id } = useParams()
  const [datos, setDatos] = useState<Comunicacion | null>(null)
  const [error, setError] = useState('')
  const [errorLectura, setErrorLectura] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    if (id)
      obtenerComunicacion(id, familia, controller.signal, docente)
        .then(async (data) => {
          if (controller.signal.aborted) return
          setDatos(data)
          setError('')
          // Una comunicación solo email no se publica en la bandeja del portal: abrir el enlace
          // no equivale a una lectura en el portal.
          if (familia && !data.leida_at && (data.canal ?? 'portal') !== 'email') {
            try {
              const leida = await registrarLectura(id)
              if (!controller.signal.aborted) {
                setDatos((actual) =>
                  actual
                    ? { ...actual, ...leida, adjuntos: leida.adjuntos ?? actual.adjuntos }
                    : leida,
                )
                setErrorLectura(false)
              }
            } catch {
              if (!controller.signal.aborted) setErrorLectura(true)
            }
          }
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setError('No se pudo abrir la comunicación o no tenés acceso.')
        })
    return () => controller.abort()
  }, [id, familia, docente, revision])
  const base = familia
    ? '/familia/comunicaciones'
    : docente
      ? '/docente/comunicaciones'
      : '/comunicaciones'
  const canal = datos?.canal ?? 'portal'
  const actualizarAdjunto = (adjunto: Adjunto) =>
    setDatos((actual) =>
      actual
        ? {
            ...actual,
            adjuntos: (actual.adjuntos ?? []).map((item) =>
              item.id === adjunto.id ? adjunto : item,
            ),
          }
        : actual,
    )
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
        <Link to={base}>
          <ArrowLeftIcon data-icon="inline-start" />
          Volver a comunicaciones
        </Link>
      </Button>
      {error ? (
        <Alert variant="error">
          <AlertDescription>
            {error}
            <Button variant="secondary" onClick={() => setRevision((v) => v + 1)}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : !datos ? (
        <Skeleton className="h-40 w-full" aria-label="Cargando comunicación" />
      ) : (
        <article className="space-y-6 rounded-panel bg-superficie p-5 shadow-card sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutro">{ETIQUETAS_TIPO[datos.tipo]}</Badge>
            <Badge variant={canal === 'portal' ? 'neutro' : 'info'}>{ETIQUETAS_CANAL[canal]}</Badge>
          </div>
          <h1 className="text-2xl font-semibold break-words text-texto">{datos.asunto}</h1>
          <p className="text-sm text-texto-2">De: {datos.emisor ?? 'Colegio ESSERI'}</p>
          <p className="text-sm text-texto-2">
            Publicada:{' '}
            {datos.publicada_at
              ? new Date(`${datos.publicada_at}Z`).toLocaleString('es-AR')
              : 'Sin publicar'}
          </p>
          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words text-texto">
            {datos.cuerpo}
          </div>
          {familia && canal === 'email' && (
            <p role="status" className="text-sm text-texto-2">
              Esta comunicación se envía por email y no aparece en la bandeja del portal.
            </p>
          )}
          {familia && canal !== 'email' && datos.leida_at && (
            <p role="status" className="text-sm text-texto-2">
              Lectura registrada para tu cuenta.
            </p>
          )}
          {!familia && (
            <p className="text-sm text-texto-2">
              {docente ? 'Comunicación de curso' : 'Disponible'} para {datos.destinatarios}{' '}
              responsables.
              {canal === 'email'
                ? ' Solo email: no aparece en la bandeja del portal familiar.'
                : canal === 'ambos'
                  ? ' Portal y email: el email queda en cola y su resultado puede ser incierto.'
                  : ' Sin envío de email.'}
            </p>
          )}
          <AdjuntosComunicacion
            comunicacionId={datos.id}
            adjuntos={datos.adjuntos ?? []}
            familia={familia}
            docente={docente}
            onActualizar={actualizarAdjunto}
          />
          {!familia && canal !== 'portal' && (
            <EnviosEmail comunicacionId={datos.id} docente={docente} />
          )}
        </article>
      )}
      {errorLectura && (
        <Alert variant="error">
          <AlertDescription>
            No se pudo registrar la lectura.
            <Button variant="secondary" onClick={() => setRevision((v) => v + 1)}>
              Reintentar lectura
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </section>
  )
}
