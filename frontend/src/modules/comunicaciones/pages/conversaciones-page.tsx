import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { CalendarDaysIcon, CreditCardIcon, InboxIcon, MessageCircleMoreIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FilterBar, FilterSearch } from '@/components/filter-bar'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  { valor: 'pendiente_familia', texto: 'En espera' },
  { valor: 'resuelta', texto: 'Resueltas' },
]

const ICONO_POR_TIPO: Record<TipoContexto, LucideIcon> = {
  debito_cobranza: CreditCardIcon,
  justificacion_inasistencia: CalendarDaysIcon,
  solicitud_ausencia_periodo: CalendarDaysIcon,
}

type FiltroTipo = 'todos' | 'debitos' | 'justificaciones'
type Orden = 'recientes' | 'antiguas'

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
          'flex items-start gap-3 rounded-card-sm border px-4 py-3 transition-colors',
          activa
            ? 'border-violeta bg-violeta-suave'
            : 'border-transparent hover:border-borde hover:bg-fila-hover',
        )}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violeta-suave text-violeta">
          <Icono aria-hidden="true" className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-texto">
                {TITULOS[consulta.contexto.tipo]}
              </span>
              <span className="line-clamp-2 text-xs leading-snug text-texto-2">
                {subtitulo(consulta)}
              </span>
            </span>
            <time
              className="shrink-0 text-xs whitespace-nowrap text-texto-2"
              dateTime={consulta.ultimo_mensaje?.created_at ?? consulta.updated_at}
            >
              {etiquetaMomento(consulta.ultimo_mensaje?.created_at ?? consulta.updated_at)}
            </time>
          </span>
          {ultimo && (
            <span className="truncate text-xs text-texto-2">
              <span className="font-medium">
                {ultimo.lado === 'administracion' ? 'Vos' : 'Familia'}:
              </span>{' '}
              {ultimo.texto}
            </span>
          )}
          <span className="flex">
            <Badge variant={consulta.estado === 'resuelta' ? 'exito' : 'advertencia'}>
              {ESTADOS[consulta.estado]}
            </Badge>
          </span>
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
  const [orden, setOrden] = useState<Orden>('antiguas')
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
    <section className="flex w-full flex-col gap-4 xl:h-[calc(100svh-7rem)]">
      <div className="xl:hidden">
        <PageHeader titulo="Conversaciones" descripcion="Consultas vinculadas a trámites." />
      </div>
      <div className="grid min-h-[calc(100svh-12rem)] gap-5 xl:min-h-0 xl:flex-1 xl:grid-rows-1 xl:grid-cols-[minmax(360px,460px)_minmax(0,1fr)]">
        <div
          className={cn(
            'min-w-0 flex-col gap-3 xl:min-h-0 rounded-panel bg-superficie p-4 shadow-card',
            seleccionada ? 'hidden xl:flex' : 'flex',
          )}
        >
          <div className="hidden xl:block">
            <h1 className="text-lg font-semibold text-texto">Conversaciones</h1>
            <p className="text-xs text-texto-2">Consultas vinculadas a trámites.</p>
          </div>
          <Tabs value={pestana} onValueChange={(valor) => setPestana(valor as Pestana)}>
            <TabsList aria-label="Estado de las conversaciones">
              {PESTANAS.map(({ valor, texto }) => (
                <TabsTrigger key={valor} value={valor}>
                  {texto}
                  {conteos && <span className="text-texto-3">{conteos[valor]}</span>}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <FilterBar>
            <FilterSearch
              value={buscar}
              onChange={setBuscar}
              placeholder="Buscar por alumno"
              className="max-w-none min-w-full"
            />
            <Select value={tipo} onValueChange={(valor) => setTipo(valor as FiltroTipo)}>
              <SelectTrigger aria-label="Tipo de trámite">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((opcion) => (
                  <SelectItem key={opcion.valor} value={opcion.valor}>
                    {opcion.texto}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={orden} onValueChange={(valor) => setOrden(valor as Orden)}>
              <SelectTrigger aria-label="Ordenar conversaciones">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="antiguas">Más antiguas</SelectItem>
                <SelectItem value="recientes">Más recientes</SelectItem>
              </SelectContent>
            </Select>
          </FilterBar>
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
              <Empty>
                <EmptyMedia variant="neutral">
                  <InboxIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>No hay conversaciones en esta vista.</EmptyTitle>
              </Empty>
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
        <div className={cn('min-w-0 xl:min-h-0', !seleccionada && 'hidden xl:block')}>
          {seleccionada ? (
            <ConversacionContextualPage
              key={seleccionada}
              enPanel
              onCambio={() => setRevision((valor) => valor + 1)}
            />
          ) : (
            <Empty className="min-h-[32rem] rounded-panel bg-superficie shadow-card xl:h-full">
              <EmptyMedia variant="icon" className="bg-violeta-suave text-violeta">
                <MessageCircleMoreIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>Seleccioná una conversación</EmptyTitle>
              <EmptyDescription>
                Elegí una solicitud de la lista para ver el detalle del trámite, consultar
                información y responder a la familia.
              </EmptyDescription>
            </Empty>
          )}
        </div>
      </div>
    </section>
  )
}
