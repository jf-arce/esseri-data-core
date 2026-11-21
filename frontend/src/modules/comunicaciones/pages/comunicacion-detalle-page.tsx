import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  Building2Icon,
  CalendarIcon,
  ChevronRightIcon,
  HomeIcon,
} from 'lucide-react'
import { ApiError } from '@/api/client'
import { PORTAL_FAMILIA_BACKGROUND } from '@/components/portal-familia/portal-familia-shell'
import { PortalFamiliaWatermark } from '@/components/portal-familia/portal-familia-watermark'
import { PortalSkeletonRegion } from '@/components/portal-familia/portal-familia-ui'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdjuntosComunicacion } from '../components/adjuntos-comunicacion'
import { EventoComunicacionDetalle } from '../components/evento-comunicacion-detalle'
import { MensajeComunicacion } from '../components/mensaje-comunicacion'
import { EntregaComunicacion } from '../components/entrega-comunicacion'
import { listarComunicaciones } from '../services/listar-comunicaciones'
import { obtenerComunicacion } from '../services/obtener-comunicacion'
import { registrarLectura } from '../services/registrar-lectura'
import type { Adjunto, Comunicacion } from '../types'
import { ETIQUETAS_CANAL, ETIQUETAS_TIPO } from '../utils'

const FORMATO_FECHA_LARGA = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'America/Argentina/Buenos_Aires',
})
const FORMATO_HORA_LARGA = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'America/Argentina/Buenos_Aires',
})

type NavegacionDetalle = {
  id: string
  anteriorId: string | null
  siguienteId: string | null
  posicion: number
  total: number
}

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
  const [datosCargados, setDatos] = useState<Comunicacion | null>(null)
  const datos = datosCargados?.id === id ? datosCargados : null
  const [retiradaId, setRetiradaId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [errorLectura, setErrorLectura] = useState(false)
  const [revision, setRevision] = useState(0)
  const [navegacion, setNavegacion] = useState<NavegacionDetalle | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    if (id)
      obtenerComunicacion(id, familia, controller.signal, docente)
        .then(async (data) => {
          if (controller.signal.aborted) return
          setDatos(data)
          setRetiradaId(null)
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
        .catch((causa: unknown) => {
          if (controller.signal.aborted) return
          if (familia && causa instanceof ApiError && causa.status === 410) {
            setDatos(null)
            setRetiradaId(id)
            return
          }
          setError('No se pudo abrir la comunicación o no tenés acceso.')
        })
    return () => controller.abort()
  }, [id, familia, docente, revision])

  useEffect(() => {
    if (!familia || !id) return
    const controller = new AbortController()
    listarComunicaciones(true, 1, '', false, controller.signal, false, undefined, 50)
      .then((listado) => {
        if (controller.signal.aborted) return
        if (listado.total > listado.items.length) {
          setNavegacion(null)
          return
        }
        const indice = listado.items.findIndex((item) => item.id === id)
        if (indice === -1) {
          setNavegacion(null)
          return
        }
        setNavegacion({
          id,
          anteriorId: listado.items[indice - 1]?.id ?? null,
          siguienteId: listado.items[indice + 1]?.id ?? null,
          posicion: indice + 1,
          total: listado.items.length,
        })
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setNavegacion(null)
      })
    return () => controller.abort()
  }, [familia, id])

  const base = familia
    ? '/familia/comunicaciones'
    : docente
      ? '/docente/comunicaciones'
      : '/comunicaciones'

  if (familia && retiradaId !== null && retiradaId === id) {
    return (
      <section className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 rounded-panel bg-superficie p-6 shadow-card">
        <h1 className="text-xl font-semibold text-texto">Comunicación retirada</h1>
        <p className="text-sm text-texto-2">
          Esta comunicación fue retirada por la institución y ya no se encuentra disponible para su
          consulta.
        </p>
        <p className="text-sm text-texto-2">
          Por favor, desestimá la información recibida anteriormente.
        </p>
        <Button asChild>
          <Link to={base}>Volver a Comunicaciones</Link>
        </Button>
      </section>
    )
  }

  const navegacionActual = navegacion?.id === id ? navegacion : null
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
      <MensajeComunicacion
        texto={datos.cuerpo}
        cuerpoRico={datos.cuerpo_rico}
        className="text-sm leading-relaxed text-texto"
      />
      {familia && canal === 'email' && (
        <p role="status" className="text-sm text-texto-2">
          Esta comunicación se envía por email y no aparece en la bandeja del portal.
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
  const fechaLarga =
    fechaPublicacion && !Number.isNaN(fechaPublicacion.getTime())
      ? `${FORMATO_FECHA_LARGA.format(fechaPublicacion)}, ${FORMATO_HORA_LARGA.format(fechaPublicacion)}`
      : 'Sin publicar'
  const eventoDetalle =
    familia && datos?.evento?.fecha ? { ...datos.evento, fecha: datos.evento.fecha } : null
  if (familia) {
    return (
      <section
        className="relative isolate -mt-6 -mb-6 min-h-[calc(100svh-4rem)] pt-6 pb-10"
        style={{ background: PORTAL_FAMILIA_BACKGROUND }}
      >
        <PortalFamiliaWatermark />

        <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col gap-5">
          <div className="flex flex-col gap-3">
            <Link
              to={base}
              className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-pf-accent transition-colors hover:text-pf-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-accent"
            >
              <ArrowLeftIcon aria-hidden="true" className="size-4" />
              Volver a comunicaciones
            </Link>
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-texto-2">
              <Link
                to="/familia"
                aria-label="Inicio"
                className="inline-flex items-center text-texto-2 transition-colors hover:text-pf-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-accent"
              >
                <HomeIcon aria-hidden="true" className="size-4" />
              </Link>
              <ChevronRightIcon aria-hidden="true" className="size-3.5 text-texto-3" />
              <Link to={base} className="transition-colors hover:text-pf-accent-hover">
                Comunicaciones
              </Link>
              <ChevronRightIcon aria-hidden="true" className="size-3.5 text-texto-3" />
              <span className="font-semibold text-texto">Detalle</span>
            </nav>
          </div>

          {error ? (
            <Alert variant="error">
              <AlertDescription>
                {error}
                <Button
                  variant="secondary"
                  className="rounded-full"
                  onClick={() => setRevision((v) => v + 1)}
                >
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          ) : !datos ? (
            <PortalSkeletonRegion etiqueta="Cargando comunicación">
              <article
                aria-hidden="true"
                className="relative overflow-hidden rounded-pf-card bg-superficie shadow-pf-card"
              >
                <div className="pointer-events-none absolute top-6 right-6 hidden w-[120px] @5xl/main:block">
                  <Skeleton className="aspect-square w-full rounded-pf-card" />
                </div>
                <div className="relative z-10 p-6 @xl/main:p-10">
                  <div className="@5xl/main:pr-[200px]">
                    <Skeleton className="h-7 w-56 rounded-full" />
                    <Skeleton className="mt-5 h-9 w-4/5" />
                    <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-5 w-44" />
                    </div>
                  </div>
                  <div className="mt-8 border-t border-pf-divisor" />
                  <div className="space-y-3 py-8">
                    {['w-full', 'w-full', 'w-11/12', 'w-full', 'w-2/3'].map((ancho, indice) => (
                      <Skeleton key={indice} className={`h-5 ${ancho}`} />
                    ))}
                  </div>
                </div>
              </article>
            </PortalSkeletonRegion>
          ) : (
            <article className="relative overflow-hidden rounded-pf-card bg-superficie shadow-pf-card">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-6 right-6 hidden w-[120px] @5xl/main:block"
              >
                <img
                  data-slot="portal-familia-detalle-logo"
                  src="/esseri-icon.png"
                  alt=""
                  className="h-auto w-full"
                />
              </div>

              <div className="relative z-10 p-6 @xl/main:p-10">
                <div className="@5xl/main:pr-[200px]">
                  <span className="inline-flex items-center gap-2 rounded-full bg-pf-lila px-3 py-1 text-xs font-semibold tracking-[0.06em] text-pf-accent uppercase">
                    <Building2Icon aria-hidden="true" className="size-4" />
                    {datos.tipo === 'curso'
                      ? 'COMUNICADO DE CURSO'
                      : datos.tipo === 'institucional'
                        ? 'COMUNICADO INSTITUCIONAL'
                        : `COMUNICADO ${ETIQUETAS_TIPO[datos.tipo].toUpperCase()}`}
                  </span>
                  <h1 className="mt-5 font-heading text-pf-titulo leading-tight font-semibold tracking-[-0.01em] text-texto @xl/main:text-pf-titulo-lg">
                    {datos.asunto}
                  </h1>
                  <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-pf-cuerpo font-medium text-texto-2">
                    <span className="inline-flex items-center gap-2">
                      <Building2Icon aria-hidden="true" className="size-4 text-pf-accent" />
                      {datos.emisor ?? 'Colegio ESSERI'}
                    </span>
                    <span
                      aria-hidden="true"
                      className="hidden h-5 w-px bg-pf-borde @xl/main:block"
                    />
                    <span className="inline-flex items-center gap-2">
                      <CalendarIcon aria-hidden="true" className="size-4 text-pf-accent" />
                      {fechaLarga}
                    </span>
                  </div>
                </div>

                <div className="mt-8 border-t border-pf-divisor" />
                <MensajeComunicacion
                  texto={datos.cuerpo}
                  cuerpoRico={datos.cuerpo_rico}
                  className="py-8 text-pf-cuerpo leading-7 text-texto @xl/main:text-pf-encabezado"
                />

                {eventoDetalle && (
                  <EventoComunicacionDetalle
                    evento={eventoDetalle}
                    destinoCalendario="/familia/calendario"
                  />
                )}

                {canal === 'email' && (
                  <p
                    role="status"
                    className="mb-6 rounded-pf-item bg-pf-item px-4 py-3 text-sm text-texto-2"
                  >
                    Esta comunicación se envía por email y no aparece en la bandeja del portal.
                  </p>
                )}

                <AdjuntosComunicacion
                  comunicacionId={datos.id}
                  adjuntos={datos.adjuntos ?? []}
                  familia={familia}
                  docente={docente}
                  onActualizar={actualizarAdjunto}
                />

                {navegacionActual && (
                  <div className="mt-8 border-t border-pf-divisor pt-6">
                    <nav
                      aria-label="Navegación entre comunicaciones"
                      className="flex flex-col gap-3 @xl/main:grid @xl/main:grid-cols-[1fr_auto_1fr] @xl/main:items-center"
                    >
                      {navegacionActual.anteriorId ? (
                        <Link
                          to={`${base}/${navegacionActual.anteriorId}`}
                          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-pf-accent/40 px-6 text-pf-cuerpo font-semibold text-pf-accent transition-colors hover:bg-(--card-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-accent @xl/main:w-auto @xl/main:justify-self-start"
                        >
                          <ArrowLeftIcon aria-hidden="true" className="size-4" />
                          Anterior
                        </Link>
                      ) : (
                        <span
                          aria-disabled="true"
                          className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-full border border-pf-accent/20 px-6 text-pf-cuerpo font-semibold text-pf-accent opacity-40 @xl/main:w-auto @xl/main:justify-self-start"
                        >
                          <ArrowLeftIcon aria-hidden="true" className="size-4" />
                          Anterior
                        </span>
                      )}
                      <span className="text-center text-pf-cuerpo font-medium text-texto-2">
                        {navegacionActual.posicion} de {navegacionActual.total}
                      </span>
                      {navegacionActual.siguienteId ? (
                        <Link
                          to={`${base}/${navegacionActual.siguienteId}`}
                          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-pf-accent px-6 text-pf-cuerpo font-semibold text-superficie transition-colors hover:bg-pf-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-accent @xl/main:w-auto @xl/main:justify-self-end"
                        >
                          Siguiente
                          <ArrowRightIcon aria-hidden="true" className="size-4" />
                        </Link>
                      ) : (
                        <span
                          aria-disabled="true"
                          className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-pf-accent/40 px-6 text-pf-cuerpo font-semibold text-superficie opacity-50 @xl/main:w-auto @xl/main:justify-self-end"
                        >
                          Siguiente
                          <ArrowRightIcon aria-hidden="true" className="size-4" />
                        </span>
                      )}
                    </nav>
                  </div>
                )}
              </div>
            </article>
          )}

          {errorLectura && (
            <Alert variant="error">
              <AlertDescription>
                No se pudo registrar la lectura.
                <Button
                  variant="secondary"
                  className="rounded-full"
                  onClick={() => setRevision((v) => v + 1)}
                >
                  Reintentar lectura
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <Button variant="ghost" asChild className="-ml-2 w-fit">
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
        <article className="space-y-6 rounded-panel bg-superficie p-5 shadow-card @xl/main:p-8">
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
