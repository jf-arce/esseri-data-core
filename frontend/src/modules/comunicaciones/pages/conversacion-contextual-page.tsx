import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  BanknoteIcon,
  CalendarDaysIcon,
  DownloadIcon,
  FileTextIcon,
  MessageCircleIcon,
  PaperclipIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react'
import { PortalFamiliaShell } from '@/components/portal-familia/portal-familia-shell'
import { PORTAL_PRIMARY_BUTTON_CLASS } from '@/components/portal-familia/portal-familia-ui'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { formatearMoneda } from '@/modules/facturacion/utils'
import { etiquetaMotivo } from '@/lib/motivos'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import {
  consultarContexto,
  consultarHilo,
  descargarAdjunto,
  enviarMensaje,
  ESTADOS,
  gestionarHilo,
  iniciarHilo,
  listarMensajes,
  rutaConversaciones,
  TITULOS,
  type Contexto,
  type Conversacion,
  type Historial,
  type Mensaje,
} from '../conversaciones'

const CANAL_ADJUNTOS = 'Máx. 10 MB (PDF, JPG, PNG)'

function vuelta(contexto: Contexto | undefined, familia: boolean) {
  if (!contexto) return familia ? '/familia/comunicaciones' : rutaConversaciones(false)
  if (familia) return '/familia/consultas'
  if (contexto.tipo === 'debito_cobranza') return '/facturacion/cobranzas'
  return contexto.tipo === 'justificacion_inasistencia'
    ? '/academico/justificaciones'
    : '/academico/solicitudes-ausencia'
}

function fecha(valor: string) {
  return new Date(`${valor}T00:00:00`).toLocaleDateString('es-AR')
}

function partes(fecha: Date) {
  const trozos = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).formatToParts(fecha)
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    trozos.find((parte) => parte.type === tipo)?.value ?? ''
  return `${valor('day')} ${valor('month').replace('.', '')} ${valor('year')}`
}

function fechaCorta(valor: string) {
  return partes(new Date(`${valor}T00:00:00`))
}

function fechaLarga(valor: string) {
  return new Date(valor).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function diaLocal(valor: string) {
  return new Date(valor).toLocaleDateString('en-CA')
}

function fechaHora(valor: string) {
  const instante = new Date(valor)
  const hora = instante.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return `${partes(instante)}, ${hora}`
}

function tamano(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function iniciales(nombre: string) {
  // "Familia (Andrés)" muestra las iniciales de la persona, no la letra del paréntesis.
  const base = /\(([^)]+)\)/.exec(nombre)?.[1] ?? nombre
  return base
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('')
}

const ESTADO_TRAMITE: Record<
  string,
  { texto: string; variante: 'exito' | 'error' | 'info' | 'neutro' }
> = {
  pendiente: { texto: 'Pendiente', variante: 'info' },
  aprobada: { texto: 'Aprobada', variante: 'exito' },
  rechazada: { texto: 'Rechazada', variante: 'error' },
  cancelada: { texto: 'Cancelada', variante: 'neutro' },
  revocada: { texto: 'Revocada', variante: 'neutro' },
  rechazado: { texto: 'Débito rechazado', variante: 'error' },
}

type DatoHeader = { icono?: LucideIcon; etiqueta: string; valor: ReactNode; crece?: boolean }

function datosDelContexto(contexto: Contexto): DatoHeader[] {
  if (contexto.tipo === 'debito_cobranza') {
    return [
      {
        icono: CalendarDaysIcon,
        etiqueta: 'Fecha del intento',
        valor: fechaCorta(contexto.fecha_intento ?? contexto.fecha_inicio),
      },
      {
        icono: BanknoteIcon,
        etiqueta: 'Importe',
        valor: contexto.importe ? formatearMoneda(contexto.importe) : '—',
      },
      {
        etiqueta: 'Motivo',
        valor: etiquetaMotivo(
          contexto.motivo,
          'El intento de débito automático no pudo ser procesado.',
        ),
        crece: true,
      },
    ]
  }
  if (contexto.tipo === 'solicitud_ausencia_periodo') {
    return [
      {
        icono: CalendarDaysIcon,
        etiqueta: 'Período',
        valor: contexto.fecha_fin
          ? `${fecha(contexto.fecha_inicio)} al ${fecha(contexto.fecha_fin)}`
          : fecha(contexto.fecha_inicio),
      },
      {
        etiqueta: 'Motivo',
        valor: etiquetaMotivo(contexto.motivo, 'Sin motivo informado'),
        crece: true,
      },
    ]
  }
  return [
    {
      icono: CalendarDaysIcon,
      etiqueta: 'Fecha de la inasistencia',
      valor: fechaCorta(contexto.fecha_inicio),
    },
    {
      etiqueta: 'Motivo',
      valor: etiquetaMotivo(contexto.motivo, 'Sin motivo informado'),
      crece: true,
    },
  ]
}

function ContextoCard({
  contexto,
  mostrarEstado,
  compacto = false,
  acciones,
}: {
  contexto: Contexto
  mostrarEstado: boolean
  compacto?: boolean
  acciones?: React.ReactNode
}) {
  const estado = contexto.estado_tramite ? ESTADO_TRAMITE[contexto.estado_tramite] : undefined
  const subtitulo = `Alumno: ${contexto.alumno_nombre}${
    contexto.alumno_curso ? ` (${contexto.alumno_curso})` : ''
  }`
  const tituloTramite = contexto.concepto ?? TITULOS[contexto.tipo]
  const todos = datosDelContexto(contexto)
  const motivo = todos.find((dato) => dato.etiqueta === 'Motivo')
  const datos = todos.filter((dato) => dato !== motivo)
  return (
    <section
      aria-label="Datos del trámite"
      className={cn(
        'flex shrink-0 flex-col rounded-panel bg-superficie shadow-card',
        compacto ? 'gap-2 p-3' : 'gap-4 p-5',
      )}
    >
      <div className={cn('flex flex-wrap items-center gap-x-6', compacto ? 'gap-y-2' : 'gap-y-4')}>
        <div
          className={cn(
            'flex min-w-0 items-center gap-3',
            compacto ? 'flex-1' : 'xl:w-[19rem] xl:shrink-0',
          )}
        >
          <span
            className={cn(
              'flex shrink-0 items-center justify-center rounded-lg bg-violeta-suave text-violeta',
              compacto ? 'size-10' : 'size-12',
            )}
          >
            <FileTextIcon aria-hidden="true" className={compacto ? 'size-5' : 'size-6'} />
          </span>
          <div className="min-w-0">
            <p className="text-base font-semibold text-texto">{tituloTramite}</p>
            <p className="truncate text-xs text-texto-2">{subtitulo}</p>
          </div>
        </div>
        {datos.map((dato) => {
          const Icono = dato.icono
          return (
            <div
              key={dato.etiqueta}
              className={cn('flex min-w-0 items-start gap-3', dato.crece && 'flex-1')}
            >
              {Icono && (
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violeta-suave/60 text-violeta">
                  <Icono aria-hidden="true" className="size-4.5" />
                </span>
              )}
              <div className={cn('min-w-0', !Icono && 'lg:pl-0')}>
                <p className="text-xs font-medium tracking-[.02em] text-texto-2">{dato.etiqueta}</p>
                <p className="text-sm font-semibold text-texto">{dato.valor}</p>
              </div>
            </div>
          )
        })}
        {estado && mostrarEstado && (
          <div className="xl:ml-auto xl:shrink-0 xl:border-l xl:border-borde xl:pl-5">
            <Badge variant={estado.variante}>{estado.texto}</Badge>
          </div>
        )}
        {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
      </div>
      {motivo && (
        <div className={cn('border-t border-borde', compacto ? 'pt-2' : 'pt-3')}>
          {compacto ? (
            <p className="truncate text-sm text-texto" title={String(motivo.valor)}>
              <span className="text-xs font-medium text-texto-2">{motivo.etiqueta}: </span>
              {motivo.valor}
            </p>
          ) : (
            <>
              <p className="text-xs font-medium tracking-[.02em] text-texto-2">{motivo.etiqueta}</p>
              <p className="text-sm text-texto">{motivo.valor}</p>
            </>
          )}
        </div>
      )}
    </section>
  )
}

function Avatar({ mensaje, propio }: { mensaje: Mensaje; propio: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        propio ? 'bg-violeta-suave text-violeta' : 'bg-fila-hover text-texto-2',
      )}
    >
      {iniciales(mensaje.autor) || (propio ? 'F' : 'A')}
    </span>
  )
}

function Adjuntos({
  mensaje,
  onDescargar,
  ocupado,
}: {
  mensaje: Mensaje
  onDescargar: (adjunto: NonNullable<Mensaje['adjuntos']>[number]) => void
  ocupado: boolean
}) {
  return (
    <ul className="mt-2 flex flex-col gap-2">
      {mensaje.adjuntos?.map((adjunto) => (
        <li
          key={adjunto.id}
          className="flex items-center gap-3 rounded-card-sm border border-borde bg-superficie px-3 py-2"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violeta-suave/60 text-violeta">
            <FileTextIcon aria-hidden="true" className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-texto">
              {adjunto.nombre}
            </span>
            <span className="block text-xs text-texto-2">
              {adjunto.tipo_contenido.includes('pdf') ? 'PDF' : 'Imagen'} ·{' '}
              {tamano(adjunto.tamanio)}
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Descargar ${adjunto.nombre}`}
            disabled={ocupado}
            onClick={() => onDescargar(adjunto)}
          >
            <DownloadIcon aria-hidden="true" className="size-4" />
          </Button>
        </li>
      ))}
    </ul>
  )
}

export function ConversacionContextualPage({
  familia = false,
  enPanel = false,
  onCambio,
}: {
  familia?: boolean
  enPanel?: boolean
  onCambio?: () => void
}) {
  const { id, tipo, contextoId } = useParams()
  const identidad = useAuthStore((state) => `${state.usuario?.id}:${state.rolActivo}`)
  return (
    <Detalle
      key={`${identidad}:${familia}:${id ?? `${tipo}:${contextoId}`}`}
      familia={familia}
      enPanel={enPanel}
      onCambio={onCambio}
    />
  )
}

function Detalle({
  familia,
  enPanel,
  onCambio,
}: {
  familia: boolean
  enPanel: boolean
  onCambio?: () => void
}) {
  const { id, tipo, contextoId } = useParams()
  const navegar = useNavigate()
  const [contexto, setContexto] = useState<Contexto>()
  const [hilo, setHilo] = useState<Conversacion>()
  const [historial, setHistorial] = useState<Historial>({ items: [], siguiente: null })
  const [puedeIniciar, setPuedeIniciar] = useState(false)
  const [permiteAdjuntos, setPermiteAdjuntos] = useState(false)
  const [archivos, setArchivos] = useState<File[]>([])
  const selectorArchivos = useRef<HTMLInputElement>(null)
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [texto, setTexto] = useState('')
  const [revision, setRevision] = useState(0)
  const clave = useRef<string | null>(null)
  const operacion = useRef<AbortController | null>(null)
  const desplazamiento = useRef<HTMLDivElement>(null)
  const alFinal = useRef(true)
  const idHilo = id ?? hilo?.id

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    async function cargar() {
      try {
        if (id) {
          const recibido = await consultarHilo(id, signal)
          if (signal.aborted) return
          setHilo(recibido)
          setContexto(recibido.contexto)
        } else if (tipo && contextoId) {
          const recibido = await consultarContexto(tipo, contextoId, signal)
          if (signal.aborted) return
          setContexto(recibido.contexto)
          setHilo(recibido.conversacion ?? undefined)
          setPuedeIniciar(recibido.puede_iniciar)
          setPermiteAdjuntos(recibido.adjuntos_habilitados)
          // Un hilo existente tiene una única URL canónica: el contexto redirige a ella.
          if (recibido.conversacion) {
            navegar(`${rutaConversaciones(familia)}/${recibido.conversacion.id}`, {
              replace: true,
            })
            return
          }
        }
      } catch {
        if (!signal.aborted) {
          setContexto(undefined)
          setHilo(undefined)
          setPuedeIniciar(false)
          setError('No se pudo abrir esta conversación.')
        }
      } finally {
        if (!signal.aborted) setCargando(false)
      }
    }
    void cargar()
    return () => controller.abort()
  }, [id, tipo, contextoId, revision, navegar, familia])

  useEffect(() => {
    if (!idHilo) return
    let consulta: AbortController | undefined
    async function refrescar() {
      if (document.visibilityState === 'hidden') return
      consulta?.abort()
      consulta = new AbortController()
      const { signal } = consulta
      try {
        const [actual, mensajes] = await Promise.all([
          consultarHilo(idHilo!, signal),
          listarMensajes(idHilo!, signal),
        ])
        if (signal.aborted) return
        setHilo(actual)
        setContexto(actual.contexto)
        setHistorial((previo) => {
          // La página más nueva siempre es la fuente de verdad: se conservan solo los mensajes
          // más viejos ya cargados con "Ver anteriores", en su orden.
          const conocidos = new Set(mensajes.items.map((mensaje) => mensaje.id))
          const anteriores = previo.items.filter((mensaje) => !conocidos.has(mensaje.id))
          return {
            items: [...mensajes.items, ...anteriores],
            siguiente: anteriores.length > 0 ? previo.siguiente : mensajes.siguiente,
          }
        })
      } catch {
        // Un fallo de sondeo no descarta el historial visible ni oculta el hilo.
        if (!signal.aborted) setError('No se pudo actualizar la conversación.')
      }
    }
    void refrescar()
    const intervalo = window.setInterval(() => void refrescar(), 30_000)
    window.addEventListener('focus', refrescar)
    return () => {
      consulta?.abort()
      window.clearInterval(intervalo)
      window.removeEventListener('focus', refrescar)
    }
  }, [idHilo, revision])

  useEffect(() => {
    const caja = desplazamiento.current
    if (!caja || !alFinal.current) return
    caja.scrollTop = caja.scrollHeight
  }, [historial.items.length, hilo?.id])

  useEffect(() => () => operacion.current?.abort(), [])

  async function ejecutar(accion: (signal: AbortSignal) => Promise<void>) {
    if (operacion.current) return
    const controller = new AbortController()
    operacion.current = controller
    setOcupado(true)
    setError('')
    try {
      await accion(controller.signal)
    } catch (fallo) {
      if (!controller.signal.aborted) {
        setError(fallo instanceof Error ? fallo.message : 'No se pudo completar la acción.')
      }
    } finally {
      if (!controller.signal.aborted) setOcupado(false)
      operacion.current = null
    }
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!texto.trim()) return
    void ejecutar(async (signal) => {
      clave.current ??= crypto.randomUUID()
      if (idHilo) {
        await enviarMensaje(idHilo, texto, clave.current, signal, archivos)
      } else if (tipo && contextoId && puedeIniciar) {
        const creado = await iniciarHilo(tipo, contextoId, texto, clave.current, signal, archivos)
        if (signal.aborted) return
        navegar(`${rutaConversaciones(familia)}/${creado.id}`, { replace: true })
      }
      if (signal.aborted) return
      clave.current = null
      setTexto('')
      setArchivos([])
      if (selectorArchivos.current) selectorArchivos.current.value = ''
      setRevision((valor) => valor + 1)
      onCambio?.()
    })
  }

  const titulo = contexto ? TITULOS[contexto.tipo] : 'Conversación'
  const descripcion = contexto
    ? `${contexto.alumno_nombre}${contexto.alumno_curso ? ` · ${contexto.alumno_curso}` : ''} · ${fecha(contexto.fecha_intento ?? contexto.fecha_inicio)}`
    : 'Consulta vinculada a un trámite'
  const destino = vuelta(contexto, familia)
  const referencia =
    contexto?.tipo === 'debito_cobranza'
      ? 'este pago'
      : contexto?.tipo === 'solicitud_ausencia_periodo'
        ? 'este período'
        : 'esta justificación'
  const propio = familia ? 'familia' : 'administracion'
  const puedeEnviar = puedeIniciar || hilo?.puede_responder
  const adjuntosHabilitados = hilo ? hilo.adjuntos_habilitados : permiteAdjuntos

  const gestion = hilo?.puede_gestionar ? (
    <Button
      variant="secondary"
      className="rounded-full"
      disabled={ocupado}
      onClick={() =>
        void ejecutar(async (signal) => {
          const actualizado = await gestionarHilo(
            hilo.id,
            hilo.estado === 'resuelta' ? 'reabrir' : 'resolver',
            signal,
          )
          if (!signal.aborted) {
            setHilo(actualizado)
            setRevision((valor) => valor + 1)
            onCambio?.()
          }
        })
      }
    >
      {hilo.estado === 'resuelta' ? 'Reabrir conversación' : 'Resolver conversación'}
    </Button>
  ) : undefined

  const estadoHilo = hilo ? (
    <Badge variant={hilo.estado === 'resuelta' ? 'exito' : 'advertencia'}>
      {ESTADOS[hilo.estado]}
    </Badge>
  ) : null

  const conversacion = (
    <>
      {contexto && (
        <ContextoCard
          contexto={contexto}
          // Con un hilo abierto, el estado que manda es el de la conversación (arriba a la
          // derecha): no se repite otro badge de "Pendiente" en la tarjeta.
          mostrarEstado={!hilo || contexto.tipo === 'debito_cobranza'}
          compacto={enPanel}
          acciones={
            enPanel ? (
              <>
                {estadoHilo}
                {gestion}
              </>
            ) : undefined
          }
        />
      )}
      <Card
        className={cn(
          'gap-0 rounded-panel bg-superficie py-0 shadow-card',
          enPanel && 'min-h-0 flex-1',
        )}
      >
        <CardContent className={cn('flex flex-col gap-4 px-5 py-4', enPanel && 'min-h-0 flex-1')}>
          {cargando && <Skeleton className="h-24 w-full" />}
          {error && (
            <Alert role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!cargando && !hilo && puedeIniciar && (
            <Empty className="py-8">
              <EmptyMedia variant="icon" className="bg-violeta-suave text-violeta">
                <MessageCircleIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>Todavía no hay una conversación sobre {referencia}</EmptyTitle>
              <EmptyDescription>
                Escribí tu consulta para comunicarte con Administración.
              </EmptyDescription>
            </Empty>
          )}
          {hilo && historial.siguiente && (
            <Button
              variant="secondary"
              className="self-start rounded-full"
              disabled={ocupado}
              onClick={() =>
                void ejecutar(async (signal) => {
                  const pagina = await listarMensajes(
                    hilo.id,
                    signal,
                    historial.siguiente ?? undefined,
                  )
                  if (!signal.aborted)
                    setHistorial((actual) => ({
                      items: [
                        ...pagina.items.filter(
                          (item) => !actual.items.some(({ id }) => id === item.id),
                        ),
                        ...actual.items,
                      ],
                      siguiente: pagina.siguiente,
                    }))
                })
              }
            >
              Ver mensajes anteriores
            </Button>
          )}
          {hilo && historial.items.length === 0 && !cargando && (
            <p className="py-6 text-center text-sm text-texto-2">
              La conversación todavía no tiene mensajes.
            </p>
          )}
          {hilo && historial.items.length > 0 && (
            <div
              ref={desplazamiento}
              role="log"
              aria-label="Historial de mensajes"
              tabIndex={0}
              onScroll={(evento) => {
                const caja = evento.currentTarget
                alFinal.current = caja.scrollHeight - caja.scrollTop - caja.clientHeight < 48
              }}
              className={cn(
                'overflow-y-auto overscroll-contain pr-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta',
                enPanel ? 'min-h-0 flex-1' : 'max-h-[min(60vh,36rem)]',
              )}
            >
              <ol className="flex flex-col">
                {historial.items.map((mensaje, indice) => {
                  const esPropio = mensaje.lado === propio
                  const anterior = historial.items[indice - 1]
                  const nuevoDia =
                    !anterior || diaLocal(anterior.created_at) !== diaLocal(mensaje.created_at)
                  const agrupado = !nuevoDia && anterior?.lado === mensaje.lado
                  return (
                    <Fragment key={mensaje.id}>
                      {nuevoDia && (
                        <li
                          className="mt-4 flex justify-center first:mt-0"
                          aria-label={`Mensajes del ${fechaLarga(mensaje.created_at)}`}
                        >
                          <span className="rounded-full bg-fila-hover px-3 py-1 text-xs font-medium text-texto-2">
                            {fechaLarga(mensaje.created_at)}
                          </span>
                        </li>
                      )}
                      <li
                        className={cn(
                          'flex items-start gap-2.5',
                          esPropio && 'flex-row-reverse',
                          agrupado ? 'mt-1' : 'mt-4',
                        )}
                      >
                        {agrupado ? (
                          <span aria-hidden="true" className="size-9 shrink-0" />
                        ) : (
                          <Avatar mensaje={mensaje} propio={esPropio} />
                        )}
                        <div
                          className={cn(
                            'flex min-w-0 max-w-[85%] flex-col sm:max-w-[75%]',
                            esPropio && 'items-end',
                          )}
                        >
                          {!agrupado && (
                            <p className="mb-1 text-xs text-texto-2">
                              <strong className="font-semibold text-texto">{mensaje.autor}</strong>
                              {' · '}
                              <time dateTime={mensaje.created_at}>
                                {fechaHora(mensaje.created_at)}
                              </time>
                            </p>
                          )}
                          <div
                            className={cn(
                              'w-full rounded-card-sm px-3.5 py-3 text-sm text-texto',
                              esPropio ? 'bg-violeta-suave' : 'bg-fila-hover',
                            )}
                          >
                            <p className="break-words whitespace-pre-wrap">{mensaje.texto}</p>
                            <Adjuntos
                              mensaje={mensaje}
                              ocupado={ocupado}
                              onDescargar={(adjunto) =>
                                void ejecutar(async () =>
                                  descargarAdjunto(hilo.id, mensaje.id, adjunto),
                                )
                              }
                            />
                          </div>
                        </div>
                      </li>
                    </Fragment>
                  )
                })}
              </ol>
            </div>
          )}
        </CardContent>
        {puedeEnviar && (
          <CardFooter className="shrink-0 border-t border-borde px-5 py-3">
            <form onSubmit={enviar} className="flex w-full flex-col gap-2">
              <label htmlFor="mensaje-contextual" className="sr-only">
                Mensaje
              </label>
              <Textarea
                id="mensaje-contextual"
                value={texto}
                maxLength={5000}
                disabled={ocupado}
                placeholder={familia ? 'Escribí tu mensaje...' : 'Escribí una respuesta...'}
                rows={2}
                className={cn(
                  'resize-none rounded-card-sm border-borde bg-superficie text-sm',
                  enPanel ? 'min-h-12' : 'min-h-16',
                )}
                onChange={(evento) => {
                  clave.current = null
                  setTexto(evento.target.value)
                }}
              />
              {archivos.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {archivos.map((archivo) => (
                    <li
                      key={`${archivo.name}-${archivo.lastModified}`}
                      className="flex items-center gap-2 rounded-full bg-violeta-suave/60 py-1 pr-1 pl-3 text-xs text-texto"
                    >
                      <span className="max-w-52 truncate">{archivo.name}</span>
                      <button
                        type="button"
                        aria-label={`Quitar ${archivo.name}`}
                        className="flex size-6 items-center justify-center rounded-full text-texto-2 hover:bg-superficie"
                        onClick={() => {
                          clave.current = null
                          setArchivos((actual) => actual.filter((item) => item !== archivo))
                          if (selectorArchivos.current) selectorArchivos.current.value = ''
                        }}
                      >
                        <XIcon aria-hidden="true" className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {adjuntosHabilitados && (
                    <>
                      <input
                        ref={selectorArchivos}
                        id="archivos-contextuales"
                        type="file"
                        className="sr-only"
                        accept="application/pdf,image/png,image/jpeg"
                        multiple
                        disabled={ocupado}
                        onChange={(evento) => {
                          clave.current = null
                          const seleccion = Array.from(evento.target.files ?? [])
                          if (
                            seleccion.length > 5 ||
                            seleccion.some((a) => a.size > 10 * 1024 * 1024)
                          ) {
                            setError('Podés adjuntar hasta 5 archivos de hasta 10 MB cada uno.')
                            evento.target.value = ''
                            setArchivos([])
                            return
                          }
                          setError('')
                          setArchivos(seleccion)
                        }}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        className="rounded-lg"
                        disabled={ocupado}
                        onClick={() => selectorArchivos.current?.click()}
                      >
                        <PaperclipIcon aria-hidden="true" className="size-4" />
                        Adjuntar archivo
                      </Button>
                      <span className={cn('text-xs text-texto-2', enPanel && 'hidden 2xl:inline')}>
                        {CANAL_ADJUNTOS}
                      </span>
                    </>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={ocupado || !texto.trim()}
                  className={familia ? PORTAL_PRIMARY_BUTTON_CLASS : undefined}
                >
                  {familia ? 'Enviar mensaje' : 'Enviar respuesta'}
                </Button>
              </div>
            </form>
          </CardFooter>
        )}
      </Card>
    </>
  )

  if (familia)
    return (
      <section className="flex flex-col gap-5">
        <PortalFamiliaShell
          titulo={titulo}
          descripcion={descripcion}
          volverA={destino}
          volverEtiqueta="Volver a Mis consultas"
          acciones={estadoHilo}
          className="px-0 pt-8 pb-4 sm:px-0"
          classNameContenido="px-4 sm:px-8"
        />
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5 px-4 pb-10 sm:px-8">
          {conversacion}
        </div>
      </section>
    )
  return (
    <section
      className={cn(
        'flex w-full flex-col',
        enPanel ? 'gap-3 xl:h-full xl:min-h-0' : 'mx-auto max-w-[1100px] gap-4',
      )}
    >
      {enPanel && (
        <Link
          to={rutaConversaciones(false)}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-violeta xl:hidden"
        >
          ← Volver a conversaciones
        </Link>
      )}
      <div className={cn('flex flex-wrap items-start justify-between gap-2', enPanel && 'hidden')}>
        <div>
          <h1 className={cn('font-semibold', enPanel ? 'text-lg' : 'text-2xl')}>{titulo}</h1>
          <p className={cn('text-texto-2', enPanel && 'text-sm')}>{descripcion}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {estadoHilo}
          {gestion}
          {!enPanel && (
            <Button variant="secondary" asChild>
              <Link to={destino}>Volver al trámite</Link>
            </Button>
          )}
        </div>
      </div>
      {conversacion}
    </section>
  )
}
