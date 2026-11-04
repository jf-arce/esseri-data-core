import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowLeftIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdjuntosComunicacion } from '../components/adjuntos-comunicacion'
import { EntregaComunicacion } from '../components/entrega-comunicacion'
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
  const [parametros, setParametros] = useSearchParams()
  const vista = parametros.get('vista') === 'entrega' ? 'entrega' : 'mensaje'
  const entregaTab = useRef<HTMLButtonElement>(null)
  function cambiarVista(valor: string) {
    setParametros((actual) => {
      const nuevos = new URLSearchParams(actual)
      if (valor === 'entrega') nuevos.set('vista', 'entrega')
      else nuevos.delete('vista')
      return nuevos
    })
  }
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
  const mensaje = datos && (
    <>
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
      <AdjuntosComunicacion
        comunicacionId={datos.id}
        adjuntos={datos.adjuntos ?? []}
        familia={familia}
        docente={docente}
        onActualizar={actualizarAdjunto}
      />
    </>
  )
  const fechaPublicacion = datos?.publicada_at
    ? new Date(
        /(?:Z|[+-]\d{2}:?\d{2})$/i.test(datos.publicada_at)
          ? datos.publicada_at
          : `${datos.publicada_at}Z`,
      )
    : null
  const fechaCompacta =
    fechaPublicacion && !Number.isNaN(fechaPublicacion.getTime())
      ? new Intl.DateTimeFormat('es-AR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
          timeZone: 'America/Argentina/Buenos_Aires',
        })
          .format(fechaPublicacion)
          .replaceAll(' de ', ' ')
      : 'Sin publicar'
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
          {familia ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutro">{ETIQUETAS_TIPO[datos.tipo]}</Badge>
              <Badge variant={canal === 'portal' ? 'neutro' : 'info'}>
                {ETIQUETAS_CANAL[canal]}
              </Badge>
            </div>
          ) : (
            <p className="text-sm text-texto-2">
              {ETIQUETAS_TIPO[datos.tipo]} · {ETIQUETAS_CANAL[canal]}
            </p>
          )}
          <h1 className="text-2xl font-semibold break-words text-texto">{datos.asunto}</h1>
          {familia ? (
            <>
              <p className="text-sm text-texto-2">De: {datos.emisor ?? 'Colegio ESSERI'}</p>
              <p className="text-sm text-texto-2">Publicada: {fechaCompacta}</p>
              {mensaje}
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-texto-2">
                <span>{datos.emisor ?? 'Colegio ESSERI'}</span>
                <span aria-hidden>·</span>
                <span>{fechaCompacta}</span>
                <span aria-hidden>·</span>
                <span
                  className={`inline-flex items-center gap-2 ${datos.estado === 'publicada' ? 'text-exito' : 'text-texto-2'}`}
                >
                  <span aria-hidden className="size-1.5 rounded-full bg-current" />
                  {datos.estado === 'publicada' ? 'Publicada' : 'Borrador'}
                </span>
              </div>
              <Tabs value={vista} onValueChange={cambiarVista}>
                <TabsList
                  aria-label="Detalle de la comunicación"
                  className="group-data-horizontal/tabs:h-11"
                >
                  <TabsTrigger value="mensaje" className="min-h-11">
                    Mensaje
                  </TabsTrigger>
                  <TabsTrigger value="entrega" ref={entregaTab} className="min-h-11">
                    Entrega ({datos.destinatarios})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="mensaje" className="space-y-6 pt-4">
                  {mensaje}
                  {datos.estado === 'publicada' && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-borde pt-3">
                      <p className="text-sm text-texto-2">
                        {datos.destinatarios} destinatario{datos.destinatarios === 1 ? '' : 's'} ·{' '}
                        {ETIQUETAS_CANAL[canal]}
                      </p>
                      <Button
                        variant="ghost"
                        className="min-h-11 text-violeta"
                        onClick={() => {
                          cambiarVista('entrega')
                          entregaTab.current?.focus()
                        }}
                      >
                        Ver entrega
                      </Button>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="entrega" className="space-y-4 pt-4">
                  {datos.estado === 'borrador' ? (
                    <p className="text-sm text-texto-2">
                      La entrega se genera al publicar la comunicación.
                    </p>
                  ) : (
                    <EntregaComunicacion
                      comunicacionId={datos.id}
                      canal={canal}
                      docente={docente}
                    />
                  )}
                </TabsContent>
              </Tabs>
            </>
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
