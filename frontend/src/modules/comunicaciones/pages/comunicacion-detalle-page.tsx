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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdjuntosComunicacion } from '../components/adjuntos-comunicacion'
import { EntregaComunicacion } from '../components/entrega-comunicacion'
import { listarComunicaciones } from '../services/listar-comunicaciones'
import { obtenerComunicacion } from '../services/obtener-comunicacion'
import { registrarLectura } from '../services/registrar-lectura'
import type { Adjunto, Comunicacion } from '../types'
import { ETIQUETAS_CANAL, ETIQUETAS_TIPO } from '../utils'

const FONDO_DETALLE =
  'radial-gradient(ellipse 60% 45% at 100% 0%, #EADFF8 0%, rgba(234,223,248,0) 60%), radial-gradient(ellipse 50% 40% at 80% 100%, #EFE5FA 0%, rgba(239,229,250,0) 65%), #F3EEF9'

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

function IlustracionSobre() {
  return (
    <svg viewBox="0 0 360 230" fill="none" aria-hidden="true" className="h-auto w-full">
      <defs>
        <linearGradient
          id="portal-familia-detalle-sobre"
          x1="108"
          y1="104"
          x2="268"
          y2="210"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#A855F7" />
          <stop offset="1" stopColor="#7A2FA8" />
        </linearGradient>
        <linearGradient
          id="portal-familia-detalle-carta"
          x1="150"
          y1="58"
          x2="226"
          y2="158"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F3E8FB" />
        </linearGradient>
      </defs>
      <g stroke="#A855F7" strokeWidth="3" strokeLinecap="round">
        <path d="M88 66 74 54" />
        <path d="M72 90 54 88" />
        <path d="M96 48 90 32" />
        <path d="M118 42l8-14" />
      </g>
      <circle cx="70" cy="58" r="4" fill="#C084FC" />
      <circle cx="102" cy="32" r="3" fill="#C084FC" />
      <path
        d="M108 104h160v92a14 14 0 0 1-14 14H122a14 14 0 0 1-14-14v-92Z"
        fill="url(#portal-familia-detalle-sobre)"
      />
      <path d="m108 104 80 58 80-58" fill="#8B3FC0" />
      <path d="m108 210 62-54 18 14 18-14 62 54" fill="#6E2A8D" opacity=".75" />
      <g transform="rotate(-4 190 116)">
        <rect
          x="134"
          y="58"
          width="112"
          height="100"
          rx="8"
          fill="url(#portal-familia-detalle-carta)"
        />
        <rect x="152" y="78" width="76" height="5" rx="2.5" fill="#D8B4FE" />
        <rect x="152" y="94" width="62" height="5" rx="2.5" fill="#E9D5FF" />
        <rect x="152" y="110" width="70" height="5" rx="2.5" fill="#E9D5FF" />
        <rect x="152" y="126" width="46" height="5" rx="2.5" fill="#F3E8FB" />
      </g>
      <path
        d="m108 104 80 58 80-58-80-48-80 48Z"
        stroke="#C084FC"
        strokeWidth="2"
        opacity=".7"
      />
    </svg>
  )
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
  const [datos, setDatos] = useState<Comunicacion | null>(null)
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
      <div className="text-sm leading-relaxed whitespace-pre-wrap break-words text-texto">
        {datos.cuerpo}
      </div>
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
  if (familia) {
    return (
      <section
        className="relative -mx-4 -mt-6 -mb-6 min-h-[calc(100svh-4rem)] overflow-hidden px-4 pt-6 pb-10 sm:-mx-8 sm:px-8"
        style={{ background: FONDO_DETALLE }}
      >
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[340px] w-full"
          viewBox="0 0 1440 340"
          preserveAspectRatio="none"
        >
          <path
            d="M0 0h1440v200c-220 95-470 8-720 62S180 350 0 286Z"
            fill="#EADFF8"
            opacity=".7"
          />
          <path
            d="M0 0h1440v110c-300 125-560 24-840 76S180 245 0 205Z"
            fill="#F1E8FA"
            opacity=".85"
          />
        </svg>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[260px] w-full"
          viewBox="0 0 1440 260"
          preserveAspectRatio="none"
        >
          <path
            d="M0 260h1440V70c-260 95-500 20-760 70S240 220 0 160Z"
            fill="#EFE5FA"
            opacity=".55"
          />
        </svg>

        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-5">
          <div className="flex flex-col gap-3">
            <Link
              to={base}
              className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#5B3A7E] transition-colors hover:text-[#3F245C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A2FA8]"
            >
              <ArrowLeftIcon aria-hidden="true" className="size-4" />
              Volver a comunicaciones
            </Link>
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-2 text-sm text-[#6B6478]"
            >
              <Link
                to="/familia"
                aria-label="Inicio"
                className="inline-flex items-center text-[#6B6478] transition-colors hover:text-[#5B3A7E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A2FA8]"
              >
                <HomeIcon aria-hidden="true" className="size-4" />
              </Link>
              <ChevronRightIcon aria-hidden="true" className="size-3.5 text-[#A995BF]" />
              <Link to={base} className="transition-colors hover:text-[#5B3A7E]">
                Comunicaciones
              </Link>
              <ChevronRightIcon aria-hidden="true" className="size-3.5 text-[#A995BF]" />
              <span className="font-semibold text-[#2B1838]">Detalle</span>
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
            <Skeleton
              className="h-64 w-full rounded-[28px]"
              aria-label="Cargando comunicación"
            />
          ) : (
            <article className="relative overflow-hidden rounded-[28px] bg-white shadow-[0_28px_70px_rgba(70,32,110,0.12)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(ellipse 55% 65% at 88% 18%, #F0E5FB 0%, rgba(240,229,251,0) 65%)',
                }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-4 right-4 hidden w-[300px] lg:block xl:w-[340px]"
              >
                <IlustracionSobre />
              </div>

              <div className="relative z-10 p-6 sm:p-10">
                <div className="lg:pr-[320px] xl:pr-[360px]">
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#F1E4FB] px-4 py-2 text-[12px] font-bold tracking-[0.08em] text-[#7A2FA8] uppercase">
                    <Building2Icon aria-hidden="true" className="size-4" />
                    {datos.tipo === 'curso'
                      ? 'COMUNICADO DE CURSO'
                      : datos.tipo === 'institucional'
                        ? 'COMUNICADO INSTITUCIONAL'
                        : `COMUNICADO ${ETIQUETAS_TIPO[datos.tipo].toUpperCase()}`}
                  </span>
                  <h1 className="mt-5 font-heading text-[32px] leading-[1.12] font-bold tracking-[-0.02em] text-[#2B1838] sm:text-[40px] xl:text-[44px]">
                    {datos.asunto}
                  </h1>
                  <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px] font-medium text-[#4A3B5C]">
                    <span className="inline-flex items-center gap-2">
                      <Building2Icon aria-hidden="true" className="size-4 text-[#7A2FA8]" />
                      {datos.emisor ?? 'Colegio ESSERI'}
                    </span>
                    <span aria-hidden="true" className="hidden h-5 w-px bg-[#E7DEF0] sm:block" />
                    <span className="inline-flex items-center gap-2">
                      <CalendarIcon aria-hidden="true" className="size-4 text-[#7A2FA8]" />
                      {fechaLarga}
                    </span>
                  </div>
                </div>

                <div className="mt-8 border-t border-[#EEE8F4]" />
                <div className="flex flex-col gap-4 py-8 text-[16px] leading-8 break-words whitespace-pre-wrap text-[#3A2E4A] sm:text-[17px]">
                  {datos.cuerpo}
                </div>

                {canal === 'email' && (
                  <p
                    role="status"
                    className="mb-6 rounded-[12px] bg-[#F7F1FC] px-4 py-3 text-sm text-[#5F4B7A]"
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
                  <div className="mt-8 border-t border-[#EEE8F4] pt-6">
                    <nav
                      aria-label="Navegación entre comunicaciones"
                      className="flex flex-col gap-3 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center"
                    >
                      {navegacionActual.anteriorId ? (
                        <Link
                          to={`${base}/${navegacionActual.anteriorId}`}
                          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[#8B4BC0]/40 px-6 text-[15px] font-semibold text-[#6E2A8D] transition-colors hover:bg-[#F6EDFB] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A2FA8] sm:w-auto sm:justify-self-start"
                        >
                          <ArrowLeftIcon aria-hidden="true" className="size-4" />
                          Anterior
                        </Link>
                      ) : (
                        <span
                          aria-disabled="true"
                          className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-full border border-[#8B4BC0]/20 px-6 text-[15px] font-semibold text-[#6E2A8D] opacity-40 sm:w-auto sm:justify-self-start"
                        >
                          <ArrowLeftIcon aria-hidden="true" className="size-4" />
                          Anterior
                        </span>
                      )}
                      <span className="text-center text-[15px] font-medium text-[#6B6478]">
                        {navegacionActual.posicion} de {navegacionActual.total}
                      </span>
                      {navegacionActual.siguienteId ? (
                        <Link
                          to={`${base}/${navegacionActual.siguienteId}`}
                          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#6E2A8D] px-6 text-[15px] font-semibold text-white transition-colors hover:bg-[#5B2078] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A2FA8] sm:w-auto sm:justify-self-end"
                        >
                          Siguiente
                          <ArrowRightIcon aria-hidden="true" className="size-4" />
                        </Link>
                      ) : (
                        <span
                          aria-disabled="true"
                          className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-[#6E2A8D]/40 px-6 text-[15px] font-semibold text-white opacity-50 sm:w-auto sm:justify-self-end"
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
