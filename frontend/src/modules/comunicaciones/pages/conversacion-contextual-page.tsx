import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { formatearMoneda } from '@/modules/facturacion/utils'
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

const CANAL_ADJUNTOS = 'Máx. 5 MB (PDF, JPG, PNG)'

function vuelta(contexto: Contexto | undefined, familia: boolean) {
  if (!contexto) return familia ? '/familia/comunicaciones' : rutaConversaciones(false)
  if (familia) return '/familia/comunicaciones'
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
        valor: contexto.motivo ?? 'El intento de débito automático no pudo ser procesado.',
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
        valor: contexto.motivo ?? 'Sin motivo informado',
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
    { etiqueta: 'Motivo', valor: contexto.motivo ?? 'Sin motivo informado', crece: true },
  ]
}

function ContextoCard({ contexto }: { contexto: Contexto }) {
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
      className="flex flex-col gap-4 rounded-[20px] border border-[#F0EAF6] bg-white p-5 shadow-[0_10px_26px_rgba(24,16,40,0.08)]"
    >
      <div className="flex flex-wrap items-center gap-4 xl:flex-nowrap">
        <div className="flex min-w-0 items-center gap-3 xl:w-[19rem] xl:shrink-0">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-[13px] bg-[#E3CEF6] text-[#832ED2]">
            <FileTextIcon aria-hidden="true" className="size-6" />
          </span>
          <div className="min-w-0">
            <p className="text-[16px] font-semibold text-[#2B2338]">{tituloTramite}</p>
            <p className="truncate text-[13px] text-[#6B6478]">{subtitulo}</p>
          </div>
        </div>
        {datos.map((dato) => {
          const Icono = dato.icono
          return (
            <div
              key={dato.etiqueta}
              className={cn(
                'flex shrink-0 items-start gap-3 xl:border-l xl:border-[#F0EAF6] xl:pl-5',
                dato.crece && 'min-w-[14rem] flex-1',
              )}
            >
              {Icono && (
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#F5F1FB] text-[#7A2FA8]">
                  <Icono aria-hidden="true" className="size-4.5" />
                </span>
              )}
              <div className={cn('min-w-0', !Icono && 'lg:pl-0')}>
                <p className="text-[12px] font-medium tracking-[.02em] text-[#6B6478]">
                  {dato.etiqueta}
                </p>
                <p className="text-[14px] font-semibold text-[#2B2338]">{dato.valor}</p>
              </div>
            </div>
          )
        })}
        {estado && (
          <div className="xl:ml-auto xl:shrink-0 xl:border-l xl:border-[#F0EAF6] xl:pl-5">
            <Badge variant={estado.variante}>{estado.texto}</Badge>
          </div>
        )}
      </div>
      {motivo && (
        <div className="border-t border-[#F0EAF6] pt-3">
          <p className="text-[12px] font-medium tracking-[.02em] text-[#6B6478]">
            {motivo.etiqueta}
          </p>
          <p className="text-[14px] text-[#2B2338]">{motivo.valor}</p>
        </div>
      )}
    </section>
  )
}

function Avatar({ mensaje }: { mensaje: Mensaje }) {
  const esFamilia = mensaje.lado === 'familia'
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold',
        esFamilia ? 'bg-[#E3CEF6] text-[#832ED2]' : 'bg-[#EDEAF2] text-[#6B6478]',
      )}
    >
      {iniciales(mensaje.autor) || (esFamilia ? 'F' : 'A')}
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
          className="flex items-center gap-3 rounded-[12px] border border-[#E7DDF1] bg-white px-3 py-2"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-[#F5F1FB] text-[#7A2FA8]">
            <FileTextIcon aria-hidden="true" className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-[#2B2338]">
              {adjunto.nombre}
            </span>
            <span className="block text-[12px] text-[#6B6478]">
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

export function ConversacionContextualPage({ familia = false }: { familia?: boolean }) {
  const { id, tipo, contextoId } = useParams()
  const identidad = useAuthStore((state) => `${state.usuario?.id}:${state.rolActivo}`)
  return (
    <Detalle key={`${identidad}:${familia}:${id ?? `${tipo}:${contextoId}`}`} familia={familia} />
  )
}

function Detalle({ familia }: { familia: boolean }) {
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
      {contexto && <ContextoCard contexto={contexto} />}
      <Card className="gap-0 rounded-[20px] border border-[#F0EAF6] bg-white py-0 shadow-[0_10px_26px_rgba(24,16,40,0.08)]">
        <CardContent className="flex flex-col gap-4 px-5 pt-5 pb-5">
          {cargando && <Skeleton className="h-24 w-full" />}
          {error && (
            <Alert role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!cargando && !hilo && puedeIniciar && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-[#F1E4FB] text-[#7A2FA8]">
                <MessageCircleIcon aria-hidden="true" className="size-7" />
              </span>
              <h2 className="text-[19px] font-semibold text-[#2B2338]">
                Todavía no hay una conversación sobre {referencia}
              </h2>
              <p className="max-w-md text-[15px] text-[#6B6478]">
                Escribí tu consulta para comunicarte con Administración.
              </p>
            </div>
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
            <p className="py-6 text-center text-sm text-[#6B6478]">
              La conversación todavía no tiene mensajes.
            </p>
          )}
          {hilo && historial.items.length > 0 && (
            <ol aria-label="Historial de mensajes" className="flex flex-col gap-5">
              {historial.items.map((mensaje) => {
                const esFamilia = mensaje.lado === 'familia'
                return (
                  <li
                    key={mensaje.id}
                    className={cn('flex items-start gap-2.5', esFamilia && 'flex-row-reverse')}
                  >
                    <Avatar mensaje={mensaje} />
                    <div
                      className={cn('flex min-w-0 max-w-[85%] flex-col', esFamilia && 'items-end')}
                    >
                      <p className="mb-1 text-[12px] text-[#6B6478]">
                        <strong className="font-semibold text-[#2B2338]">{mensaje.autor}</strong>
                        {' · '}
                        <time dateTime={mensaje.created_at}>{fechaHora(mensaje.created_at)}</time>
                      </p>
                      <div
                        className={cn(
                          'w-full rounded-[14px] px-3.5 py-3 text-[14px] text-[#2B2338]',
                          esFamilia ? 'bg-[#F1E4FB]' : 'bg-[#F6F4F9]',
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
                )
              })}
            </ol>
          )}
        </CardContent>
        {puedeEnviar && (
          <CardFooter className="border-t border-[#F0EAF6] px-5 py-4">
            <form onSubmit={enviar} className="flex w-full flex-col gap-3">
              <label htmlFor="mensaje-contextual" className="sr-only">
                Mensaje
              </label>
              <Textarea
                id="mensaje-contextual"
                value={texto}
                maxLength={5000}
                disabled={ocupado}
                placeholder="Escribí tu mensaje..."
                className="min-h-20 rounded-[12px] border-[#E7DDF1] bg-white text-[14px]"
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
                      className="flex items-center gap-2 rounded-full bg-[#F5F1FB] py-1 pr-1 pl-3 text-[12px] text-[#2B2338]"
                    >
                      <span className="max-w-52 truncate">{archivo.name}</span>
                      <button
                        type="button"
                        aria-label={`Quitar ${archivo.name}`}
                        className="flex size-6 items-center justify-center rounded-full text-[#6B6478] hover:bg-white"
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
                            seleccion.some((a) => a.size > 5 * 1024 * 1024)
                          ) {
                            setError('Podés adjuntar hasta 5 archivos de hasta 5 MB cada uno.')
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
                        className="rounded-[10px]"
                        disabled={ocupado}
                        onClick={() => selectorArchivos.current?.click()}
                      >
                        <PaperclipIcon aria-hidden="true" className="size-4" />
                        Adjuntar archivo
                      </Button>
                      <span className="text-[12px] text-[#6B6478]">{CANAL_ADJUNTOS}</span>
                    </>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={ocupado || !texto.trim()}
                  className={familia ? PORTAL_PRIMARY_BUTTON_CLASS : undefined}
                >
                  Enviar mensaje
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
          volverEtiqueta="Volver a Comunicaciones"
          acciones={estadoHilo}
        />
        {conversacion}
      </section>
    )
  return (
    <section className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{titulo}</h1>
          <p className="text-texto-2">{descripcion}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {estadoHilo}
          {gestion}
          <Button variant="secondary" asChild>
            <Link to={destino}>Volver al trámite</Link>
          </Button>
        </div>
      </div>
      {conversacion}
    </section>
  )
}
