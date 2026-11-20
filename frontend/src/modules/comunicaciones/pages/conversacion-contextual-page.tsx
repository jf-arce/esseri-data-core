import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PortalFamiliaShell } from '@/components/portal-familia/portal-familia-shell'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/store/auth-store'
import {
  consultarContexto,
  consultarHilo,
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
} from '../conversaciones'

function vuelta(contexto: Contexto | undefined, familia: boolean) {
  if (!contexto) return familia ? '/familia' : rutaConversaciones(false)
  if (contexto.tipo === 'debito_cobranza') {
    return familia
      ? `/familia/facturacion?factura=${contexto.factura_id ?? ''}`
      : '/facturacion/cobranzas'
  }
  if (familia) return '/familia/asistencias'
  return contexto.tipo === 'justificacion_inasistencia'
    ? '/academico/justificaciones'
    : '/academico/solicitudes-ausencia'
}

function fecha(valor: string) {
  return new Date(`${valor}T00:00:00`).toLocaleDateString('es-AR')
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
  }, [id, tipo, contextoId, revision])

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
        setHistorial((previo) => {
          const primero = mensajes.items[0]?.id
          const anteriores = previo.items.findIndex((mensaje) => mensaje.id === primero)
          return anteriores > 0
            ? {
                items: [...previo.items.slice(0, anteriores), ...mensajes.items],
                siguiente: previo.siguiente,
              }
            : mensajes
        })
      } catch {
        if (!signal.aborted) {
          setHistorial({ items: [], siguiente: null })
          setHilo(undefined)
          setPuedeIniciar(false)
          setError('No se pudo actualizar la conversación.')
        }
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
        await enviarMensaje(idHilo, texto, clave.current, signal)
      } else if (tipo && contextoId && puedeIniciar) {
        const creado = await iniciarHilo(tipo, contextoId, texto, clave.current, signal)
        if (signal.aborted) return
        navegar(`${rutaConversaciones(familia)}/${creado.id}`, { replace: true })
      }
      if (signal.aborted) return
      clave.current = null
      setTexto('')
      setRevision((valor) => valor + 1)
    })
  }

  const titulo = contexto ? TITULOS[contexto.tipo] : 'Conversación'
  const descripcion = contexto
    ? `${contexto.alumno_nombre} · ${fecha(contexto.fecha_inicio)}${contexto.fecha_fin ? ` al ${fecha(contexto.fecha_fin)}` : ''}`
    : 'Consulta vinculada a un trámite'
  const destino = vuelta(contexto, familia)
  const contenido = (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-5">
        {cargando && <Skeleton className="h-24 w-full" />}
        {error && (
          <Alert role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {hilo && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant={hilo.estado === 'resuelta' ? 'exito' : 'info'}>
              {ESTADOS[hilo.estado]}
            </Badge>
            {hilo.puede_gestionar && (
              <Button
                variant="secondary"
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
            )}
          </div>
        )}
        {hilo && historial.siguiente && (
          <Button
            variant="secondary"
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
        {hilo && (
          <ol aria-label="Historial de mensajes" className="divide-y divide-borde">
            {historial.items.map((mensaje) => (
              <li key={mensaje.id} className="py-3">
                <div className="flex flex-wrap justify-between gap-1 text-sm">
                  <strong>{mensaje.autor}</strong>
                  <time className="text-texto-2" dateTime={mensaje.created_at}>
                    {new Date(mensaje.created_at).toLocaleString('es-AR')}
                  </time>
                </div>
                <p className="mt-1 break-words whitespace-pre-wrap">{mensaje.texto}</p>
              </li>
            ))}
          </ol>
        )}
        {(puedeIniciar || hilo?.puede_responder) && (
          <form onSubmit={enviar} className="flex flex-col items-start gap-2">
            <label htmlFor="mensaje-contextual" className="text-sm font-medium">
              Mensaje
            </label>
            <Textarea
              id="mensaje-contextual"
              value={texto}
              maxLength={5000}
              disabled={ocupado}
              onChange={(evento) => {
                clave.current = null
                setTexto(evento.target.value)
              }}
            />
            <Button type="submit" disabled={ocupado || !texto.trim()}>
              Enviar mensaje
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )

  if (familia)
    return (
      <section className="flex flex-col gap-4">
        <PortalFamiliaShell
          titulo={titulo}
          descripcion={descripcion}
          volverA={destino}
          volverEtiqueta="Volver al trámite"
        />
        {contenido}
      </section>
    )
  return (
    <section className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{titulo}</h1>
          <p className="text-texto-2">{descripcion}</p>
        </div>
        <Button variant="secondary" asChild>
          <Link to={destino}>Volver al trámite</Link>
        </Button>
      </div>
      {contenido}
    </section>
  )
}
