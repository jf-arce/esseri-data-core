import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  CalendarDaysIcon,
  ChevronDownIcon,
  CreditCardIcon,
  InboxIcon,
  MessageCircleMoreIcon,
  SearchIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { normalizarTexto } from '@/lib/texto'
import { etiquetaMotivo } from '@/lib/motivos'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'
import {
  ESTADOS,
  listarConversaciones,
  TITULOS,
  URL_CONVERSACIONES,
  type ConsultaResumen,
  type TipoContexto,
} from '../conversaciones'
import { ConversacionContextualPage } from './conversacion-contextual-page'

type Pestana = 'pendiente_administracion' | 'pendiente_familia' | 'resuelta'

const PESTANAS: { valor: Pestana; texto: string }[] = [
  { valor: 'pendiente_administracion', texto: 'Pendientes' },
  { valor: 'pendiente_familia', texto: 'En espera de la familia' },
  { valor: 'resuelta', texto: 'Resueltas' },
]

const ICONO_POR_TIPO: Record<TipoContexto, LucideIcon> = {
  debito_cobranza: CreditCardIcon,
  justificacion_inasistencia: CalendarDaysIcon,
  solicitud_ausencia_periodo: CalendarDaysIcon,
}

type FiltroTipo = 'todos' | 'debitos' | 'justificaciones'

const TIPOS: { valor: FiltroTipo; texto: string }[] = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'debitos', texto: 'Débitos' },
  { valor: 'justificaciones', texto: 'Justificaciones' },
]

function etiquetaMomento(valor: string) {
  const fecha = new Date(valor)
  const dia = fecha.toLocaleDateString('en-CA')
  const hoy = new Date().toLocaleDateString('en-CA')
  const ayer = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA')
  const hora = fecha.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  if (dia === hoy) return `Hoy, ${hora}`
  if (dia === ayer) return `Ayer, ${hora}`
  return `${fecha.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}, ${hora}`
}

function diaMes(valor: string) {
  return new Date(`${valor}T00:00:00`).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
  })
}

function subtitulo(consulta: ConsultaResumen) {
  const { contexto } = consulta
  const detalle =
    contexto.concepto ??
    (contexto.fecha_fin
      ? `${etiquetaMotivo(contexto.motivo, 'Justificación')} · ${diaMes(contexto.fecha_inicio)} al ${diaMes(contexto.fecha_fin)}`
      : etiquetaMotivo(contexto.motivo, 'Consulta'))
  return `${contexto.alumno_nombre} · ${detalle}`
}

function FilaConsulta({ consulta, activa }: { consulta: ConsultaResumen; activa: boolean }) {
  const Icono = ICONO_POR_TIPO[consulta.contexto.tipo]
  const ultimo = consulta.ultimo_mensaje
  return (
    <li>
      <Link
        to={`${URL_CONVERSACIONES}/${consulta.id}`}
        aria-current={activa ? 'true' : undefined}
        className={cn(
          'flex flex-col gap-1.5 rounded-[16px] border px-4 py-3 transition-colors',
          activa
            ? 'border-violeta bg-violeta-suave'
            : 'border-transparent hover:border-borde hover:bg-fila-hover',
        )}
      >
        <span className="flex items-start justify-between gap-3">
          <span className="flex min-w-0 items-start gap-3">
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-[11px]',
                activa ? 'bg-violeta-suave text-violeta' : 'bg-violeta-suave text-violeta',
              )}
            >
              <Icono aria-hidden="true" className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold text-texto">
                {TITULOS[consulta.contexto.tipo]}
              </span>
              <span className="line-clamp-2 text-[13px] leading-snug text-texto-2">
                {subtitulo(consulta)}
              </span>
            </span>
          </span>
          <time
            className="shrink-0 text-[12px] whitespace-nowrap text-texto-2"
            dateTime={consulta.ultimo_mensaje?.created_at ?? consulta.updated_at}
          >
            {etiquetaMomento(consulta.ultimo_mensaje?.created_at ?? consulta.updated_at)}
          </time>
        </span>
        {ultimo && (
          <span className="truncate pl-13 text-[13px] text-texto-2">
            <span className="font-medium">
              {ultimo.lado === 'administracion' ? 'Vos' : 'Familia'}:
            </span>{' '}
            {ultimo.texto}
          </span>
        )}
        <span className="flex justify-end pl-13">
          <Badge variant={consulta.estado === 'resuelta' ? 'exito' : 'advertencia'}>
            {ESTADOS[consulta.estado]}
          </Badge>
        </span>
      </Link>
    </li>
  )
}

export function ConversacionesPage() {
  const { id } = useParams()
  const identidad = useAuthStore((state) => `${state.usuario?.id}:${state.rolActivo}`)
  return <Panel key={identidad} seleccionada={id} />
}

function Panel({ seleccionada }: { seleccionada?: string }) {
  const [pestana, setPestana] = useState<Pestana>('pendiente_administracion')
  const [buscar, setBuscar] = useState('')
  const [tipo, setTipo] = useState<FiltroTipo>('todos')
  const [orden, setOrden] = useState<'recientes' | 'antiguas'>('antiguas')
  const [items, setItems] = useState<ConsultaResumen[]>([])
  const [conteos, setConteos] = useState<Record<Pestana, number> | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void Promise.all(
      PESTANAS.map(({ valor }) =>
        listarConversaciones({ estado: valor, limite: 100 }, controller.signal).then((datos) => [
          valor,
          datos.items.length,
        ]),
      ),
    )
      .then((pares) => {
        if (!controller.signal.aborted)
          setConteos(Object.fromEntries(pares) as Record<Pestana, number>)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [revision])

  useEffect(() => {
    const controller = new AbortController()
    void listarConversaciones(
      {
        estado: pestana,
        limite: 100,
      },
      controller.signal,
    )
      .then((datos) => {
        if (controller.signal.aborted) return
        setItems(
          datos.items.filter((item) =>
            tipo === 'todos'
              ? true
              : tipo === 'debitos'
                ? item.contexto.tipo === 'debito_cobranza'
                : item.contexto.tipo !== 'debito_cobranza',
          ),
        )
        setError(false)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargando(false)
      })
    return () => controller.abort()
  }, [pestana, tipo, revision])

  const visibles = useMemo(() => {
    const termino = normalizarTexto(buscar)
    const filtradas = termino
      ? items.filter((item) =>
          normalizarTexto(
            [
              item.contexto.alumno_nombre,
              item.contexto.concepto,
              etiquetaMotivo(item.contexto.motivo, ''),
              item.ultimo_mensaje?.texto,
            ]
              .filter(Boolean)
              .join(' '),
          ).includes(termino),
        )
      : items
    return [...filtradas].sort((a, b) => {
      const referencia = (item: ConsultaResumen) =>
        new Date(item.ultimo_mensaje?.created_at ?? item.updated_at).getTime()
      return orden === 'antiguas' ? referencia(a) - referencia(b) : referencia(b) - referencia(a)
    })
  }, [items, buscar, orden])

  return (
    <section className="flex w-full flex-col gap-4">
      <PageHeader titulo="Conversaciones" descripcion="Consultas vinculadas a trámites." />
      <div className="grid min-h-[calc(100svh-12rem)] gap-5 xl:grid-cols-[minmax(360px,460px)_minmax(0,1fr)]">
        <div
          className={cn(
            'min-w-0 flex-col gap-3 rounded-[18px] bg-superficie p-3 shadow-card',
            seleccionada ? 'hidden xl:flex' : 'flex',
          )}
        >
          <div
            role="tablist"
            aria-label="Estado de las conversaciones"
            className="flex gap-1 overflow-x-auto"
          >
            {PESTANAS.map(({ valor, texto }) => (
              <button
                key={valor}
                type="button"
                role="tab"
                aria-selected={pestana === valor}
                onClick={() => setPestana(valor)}
                className={cn(
                  'min-h-9 shrink-0 rounded-full px-3 text-[13px] font-semibold whitespace-nowrap transition-colors',
                  pestana === valor
                    ? 'bg-violeta-suave text-violeta'
                    : 'text-texto-2 hover:bg-fila-hover',
                )}
              >
                {texto}
                {conteos ? ` (${conteos[valor]})` : ''}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <SearchIcon
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texto-3"
              />
              <Input
                aria-label="Buscar conversaciones"
                placeholder="Buscar por alumno, familia o mensaje..."
                className="pl-9"
                value={buscar}
                onChange={(evento) => setBuscar(evento.target.value)}
              />
            </div>
            <div role="group" aria-label="Tipo de trámite" className="flex gap-1">
              {TIPOS.map((opcion) => (
                <button
                  key={opcion.valor}
                  type="button"
                  aria-pressed={tipo === opcion.valor}
                  onClick={() => setTipo(opcion.valor)}
                  className={cn(
                    'min-h-9 rounded-full px-3 text-[13px] font-semibold whitespace-nowrap transition-colors',
                    tipo === opcion.valor
                      ? 'bg-violeta text-superficie'
                      : 'text-texto-2 hover:bg-fila-hover',
                  )}
                >
                  {opcion.texto}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-texto-2">Ordenar por</span>
            <button
              type="button"
              onClick={() => setOrden((valor) => (valor === 'antiguas' ? 'recientes' : 'antiguas'))}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-[10px] border border-borde px-3 text-[13px] font-medium text-texto hover:bg-fila-hover"
            >
              {orden === 'antiguas' ? 'Más antiguas' : 'Más recientes'}
              <ChevronDownIcon aria-hidden="true" className="size-3.5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {cargando ? (
              <div className="flex flex-col gap-2 p-1">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : error ? (
              <Alert role="alert">
                <AlertDescription>No se pudieron cargar las conversaciones.</AlertDescription>
              </Alert>
            ) : visibles.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-fila-hover text-texto-3">
                  <InboxIcon aria-hidden="true" className="size-5" />
                </span>
                <p className="text-sm font-medium text-texto">
                  No hay conversaciones en esta vista.
                </p>
              </div>
            ) : (
              <ul aria-label="Conversaciones" className="flex flex-col gap-1">
                {visibles.map((consulta) => (
                  <FilaConsulta
                    key={consulta.id}
                    consulta={consulta}
                    activa={consulta.id === seleccionada}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className={cn('min-w-0', !seleccionada && 'hidden xl:block')}>
          {seleccionada ? (
            <ConversacionContextualPage
              key={seleccionada}
              enPanel
              onCambio={() => setRevision((valor) => valor + 1)}
            />
          ) : (
            <div className="flex min-h-[32rem] flex-col items-center justify-center gap-5 rounded-[18px] border border-borde bg-superficie p-8 text-center xl:sticky xl:top-4 xl:h-[calc(100svh-9rem)]">
              <span className="flex size-32 items-center justify-center rounded-full bg-violeta-suave text-violeta @xl/main:size-40">
                <MessageCircleMoreIcon aria-hidden="true" className="size-14 @xl/main:size-16" />
              </span>
              <div className="space-y-3">
                <h2 className="text-2xl font-semibold text-texto">Seleccioná una conversación</h2>
                <p className="mx-auto max-w-md text-base text-balance text-texto-2">
                  Elegí una solicitud de la lista para ver el detalle del trámite, consultar
                  información y responder a la familia.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
