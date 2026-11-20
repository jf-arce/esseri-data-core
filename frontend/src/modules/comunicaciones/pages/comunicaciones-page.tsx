import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MessageSquareTextIcon,
  FilterIcon,
  MegaphoneIcon,
  PlusIcon,
  SearchIcon,
  UsersIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { PaginadorServidor } from '@/components/paginador-servidor'
import {
  PORTAL_FAMILIA_BACKGROUND,
  PortalFamiliaShell,
} from '@/components/portal-familia/portal-familia-shell'
import { PortalFamiliaWatermark } from '@/components/portal-familia/portal-familia-watermark'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatearDiaDeInstante } from '@/lib/fechas'
import { paginasVisibles } from '@/lib/paginacion'
import { cn } from '@/lib/utils'
import { listarComunicaciones } from '../services/listar-comunicaciones'
import type { Comunicacion, Listado } from '../types'
import { ETIQUETAS_CANAL, ETIQUETAS_TIPO } from '../utils'

type FiltroEstado = 'todas' | 'publicada' | 'borrador'
type OrdenFecha = 'recientes' | 'antiguas'
type TipoVisual = 'institucional' | 'curso' | 'otro'

const ESTILOS_TIPO: Record<TipoVisual, { pill: string; tile: string; Icon: LucideIcon }> = {
  institucional: {
    pill: 'bg-pf-lila text-pf-accent',
    tile: 'bg-pf-lila text-pf-accent',
    Icon: MegaphoneIcon,
  },
  curso: {
    pill: 'bg-pf-azul-bg text-pf-azul-fg',
    tile: 'bg-pf-azul-bg text-pf-azul-fg',
    Icon: UsersIcon,
  },
  otro: {
    pill: 'bg-pf-verde-bg text-exito',
    tile: 'bg-pf-verde-bg text-pf-verde-fg',
    Icon: MessageSquareTextIcon,
  },
}

const FECHA_DIA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const FECHA_HORA = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const FECHA_CORTA = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function tipoVisual(tipo: Comunicacion['tipo']): TipoVisual {
  if (tipo === 'institucional') return 'institucional'
  if (tipo === 'curso') return 'curso'
  return 'otro'
}

/** "Hoy", "Ayer" o "12 may", siempre en hora argentina. */
function fechaCortaComunicacion(valor: string | null): string {
  if (!valor) return 'Sin fecha'
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return 'Sin fecha'
  const dia = FECHA_DIA.format(fecha)
  if (dia === FECHA_DIA.format(new Date())) return 'Hoy'
  if (dia === FECHA_DIA.format(new Date(Date.now() - 86_400_000))) return 'Ayer'
  const partes = FECHA_CORTA.formatToParts(fecha)
  const valorParte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? ''
  return `${valorParte('day')} ${valorParte('month').replace('.', '')}`
}

/** "Hoy, 15:26", "Ayer, 11:05" o "10 nov 2026, 09:30", siempre en hora argentina. */
function fechaComunicacion(valor: string | null): string {
  if (!valor) return 'Sin fecha'
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return 'Sin fecha'
  const dia = FECHA_DIA.format(fecha)
  const hoy = FECHA_DIA.format(new Date())
  const ayer = FECHA_DIA.format(new Date(Date.now() - 86_400_000))
  const hora = FECHA_HORA.format(fecha)
  if (dia === hoy) return `Hoy, ${hora}`
  if (dia === ayer) return `Ayer, ${hora}`
  const partes = FECHA_CORTA.formatToParts(fecha)
  const valorParte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? ''
  return `${valorParte('day')} ${valorParte('month').replace('.', '')} ${valorParte('year')}, ${hora}`
}

function etiquetaAudiencia(c: Comunicacion): string {
  switch (c.audiencia?.tipo) {
    case 'todos':
      return 'Todo el colegio'
    case 'nivel':
      return 'Nivel'
    case 'division':
      return 'División'
    case 'alumnos':
      return 'Alumnos'
    case 'responsables':
      return 'Responsables'
    default:
      return '—'
  }
}

type Conteos = { todas: number | null; noLeidas: number | null }

type ListaFamiliaProps = {
  datos: Listado | null
  error: boolean
  buscar: string
  onBuscar: (valor: string) => void
  noLeidas: boolean
  onNoLeidas: (valor: boolean) => void
  orden: OrdenFecha
  onOrden: (valor: OrdenFecha) => void
  pagina: number
  onPagina: (pagina: number) => void
  conteos: Conteos
  onReintentar: () => void
  base: string
}

function PieLista({
  pagina,
  total,
  totalPaginas,
  onCambiarPagina,
}: {
  pagina: number
  total: number
  totalPaginas: number
  onCambiarPagina: (pagina: number) => void
}) {
  if (total === 0) return null
  const primera = (pagina - 1) * 5 + 1
  const ultima = Math.min(total, pagina * 5)
  return (
    <div className="flex flex-col gap-3 border-t border-pf-divisor px-4 py-4 @xl/main:flex-row @xl/main:items-center @xl/main:justify-between @xl/main:px-6">
      <p className="text-sm text-texto">
        {primera}–{ultima} de {total} comunicaciones
      </p>
      {totalPaginas > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Ir a la página anterior"
            disabled={pagina === 1}
            onClick={() => onCambiarPagina(pagina - 1)}
            className="flex size-9 items-center justify-center rounded-pf-input border border-pf-divisor text-texto transition-colors hover:bg-pf-item disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeftIcon aria-hidden="true" className="size-4" />
          </button>
          {paginasVisibles(totalPaginas, pagina).map((item, indice) =>
            item === 'elipsis' ? (
              <span key={`elipsis-${indice}`} className="px-1 text-sm text-texto-2">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                aria-label={`Ir a la página ${item}`}
                aria-current={item === pagina ? 'page' : undefined}
                onClick={() => onCambiarPagina(item)}
                className={cn(
                  'size-9 rounded-pf-input text-sm font-semibold tabular-nums transition-colors',
                  item === pagina
                    ? 'bg-pf-accent text-superficie'
                    : 'text-texto hover:bg-pf-item-hover',
                )}
              >
                {item}
              </button>
            ),
          )}
          <button
            type="button"
            aria-label="Ir a la página siguiente"
            disabled={pagina === totalPaginas}
            onClick={() => onCambiarPagina(pagina + 1)}
            className="flex size-9 items-center justify-center rounded-pf-input border border-pf-divisor text-texto transition-colors hover:bg-pf-item disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRightIcon aria-hidden="true" className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}

function ListaFamiliaMovil({
  datos,
  error,
  buscar,
  onBuscar,
  noLeidas,
  onNoLeidas,
  orden,
  onOrden,
  pagina,
  onPagina,
  conteos,
  onReintentar,
  base,
}: ListaFamiliaProps) {
  const [filtroTipo, setFiltroTipo] = useState<'todas' | TipoVisual>('todas')
  const publicadas = datos?.items ?? []
  const visibles =
    filtroTipo === 'todas'
      ? publicadas
      : publicadas.filter((comunicacion) => tipoVisual(comunicacion.tipo) === filtroTipo)

  return (
    <section
      className="relative isolate -mb-6 min-h-[calc(100svh-4rem)]"
      style={{ background: PORTAL_FAMILIA_BACKGROUND }}
    >
      <PortalFamiliaWatermark />
      <div className="relative z-10">
        <PortalFamiliaShell
          titulo="Comunicaciones"
          descripcion="Avisos institucionales y de curso"
          etiqueta="Portal de familia"
          volverA="/familia"
          volverEtiqueta="Volver al inicio"
          className="pb-8"
        />

        <div className="flex w-full flex-col gap-4 pb-10">
          <div className="relative w-full">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-texto-3"
            />
            <Input
              aria-label="Buscar comunicaciones"
              placeholder="Buscar comunicaciones..."
              value={buscar}
              onChange={(event) => onBuscar(event.target.value)}
              className="h-10 rounded-full border-pf-borde bg-superficie pl-10 text-pf-cuerpo text-texto placeholder:text-texto-3"
            />
          </div>

          <div
            className="flex w-full rounded-full bg-pf-item-hover p-1 sm:w-fit"
            role="group"
            aria-label="Filtrar comunicaciones"
          >
            <button
              type="button"
              aria-pressed={!noLeidas}
              onClick={() => onNoLeidas(false)}
              className={cn(
                'min-h-9 flex-1 rounded-full px-4 text-pf-cuerpo font-semibold transition-colors',
                !noLeidas ? 'bg-pf-accent text-superficie' : 'text-texto hover:text-texto',
              )}
            >
              Todas ({conteos.todas ?? '—'})
            </button>
            <button
              type="button"
              aria-pressed={noLeidas}
              onClick={() => onNoLeidas(true)}
              className={cn(
                'inline-flex min-h-9 flex-1 sm:flex-none items-center justify-center gap-2 rounded-full px-4 text-pf-cuerpo font-semibold transition-colors',
                noLeidas ? 'bg-pf-accent text-superficie' : 'text-texto hover:text-texto',
              )}
            >
              No leídas ({conteos.noLeidas ?? '—'})
              {(conteos.noLeidas ?? 0) > 0 && (
                <span
                  aria-hidden="true"
                  className={cn('size-2 rounded-full', noLeidas ? 'bg-superficie' : 'bg-pf-accent')}
                />
              )}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={orden} onValueChange={(valor) => onOrden(valor as OrdenFecha)}>
              <SelectTrigger
                aria-label="Ordenar comunicaciones por fecha"
                className="h-10 min-w-0 flex-1 rounded-full border-pf-borde bg-superficie px-4 text-sm font-medium text-texto"
              >
                <span className="flex items-center gap-2">
                  <CalendarDaysIcon aria-hidden="true" className="size-4 text-pf-accent" />
                  {orden === 'recientes' ? 'Fecha: más recientes' : 'Fecha: más antiguas'}
                  <ChevronDownIcon aria-hidden="true" className="size-4 text-texto-2" />
                </span>
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectItem value="recientes">
                  <ArrowDownIcon aria-hidden="true" />
                  Más recientes primero
                </SelectItem>
                <SelectItem value="antiguas">
                  <ArrowUpIcon aria-hidden="true" />
                  Más antiguas primero
                </SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-pf-borde bg-superficie px-4 text-sm font-medium text-texto"
                >
                  <FilterIcon aria-hidden="true" className="size-4 text-pf-accent" />
                  {filtroTipo === 'todas'
                    ? 'Filtrar'
                    : `Filtrar: ${ETIQUETAS_TIPO[filtroTipo === 'institucional' ? 'institucional' : filtroTipo === 'curso' ? 'curso' : 'otro']}`}
                  <ChevronDownIcon aria-hidden="true" className="size-4 text-texto-2" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="portal-familia w-56 p-2">
                {[
                  { clave: 'todas', etiqueta: 'Todas' },
                  { clave: 'institucional', etiqueta: 'Institucional' },
                  { clave: 'curso', etiqueta: 'Curso' },
                  { clave: 'otro', etiqueta: 'Otro' },
                ].map(({ clave, etiqueta }) => (
                  <button
                    key={clave}
                    type="button"
                    aria-pressed={filtroTipo === clave}
                    onClick={() => setFiltroTipo(clave as 'todas' | TipoVisual)}
                    className={cn(
                      'flex min-h-9 w-full items-center rounded-pf-input px-3 text-left text-sm font-medium transition-colors',
                      filtroTipo === clave
                        ? 'bg-pf-lila text-pf-accent'
                        : 'text-texto hover:bg-pf-item',
                    )}
                  >
                    {etiqueta}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>

          {error ? (
            <Alert variant="error">
              <AlertDescription>
                No se pudieron cargar las comunicaciones.{' '}
                <Button variant="secondary" className="rounded-full" onClick={onReintentar}>
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          ) : !datos ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((fila) => (
                <Skeleton key={fila} className="h-24 w-full rounded-pf-tile bg-pf-item" />
              ))}
            </div>
          ) : visibles.length === 0 ? (
            <p role="status" className="py-10 text-center text-pf-cuerpo text-texto-2">
              No hay comunicaciones para mostrar.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {visibles.map((c) => {
                const visual = ESTILOS_TIPO[tipoVisual(c.tipo)]
                const Icono = visual.Icon
                return (
                  <li key={c.id}>
                    <Link
                      to={`${base}/${c.id}`}
                      className={cn(
                        'flex items-start gap-3 rounded-pf-tile border p-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-accent @xl/main:p-4',
                        c.leida_at
                          ? 'border-pf-divisor bg-superficie hover:bg-pf-item'
                          : 'border-transparent bg-pf-lila hover:bg-pf-lila-fuerte',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'mt-4 size-2 shrink-0 rounded-full',
                          c.leida_at ? 'bg-transparent' : 'bg-pf-accent',
                        )}
                      />
                      <span
                        className={cn(
                          'flex size-10 shrink-0 items-center justify-center rounded-pf-item',
                          visual.tile,
                        )}
                      >
                        <Icono aria-hidden="true" className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span
                            className={cn(
                              'inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                              visual.pill,
                            )}
                          >
                            {ETIQUETAS_TIPO[c.tipo]}
                          </span>
                          <span className="shrink-0 text-sm text-texto-2">
                            {fechaCortaComunicacion(c.publicada_at ?? c.created_at)}
                          </span>
                        </span>
                        <span className="mt-1 block truncate font-heading text-pf-cuerpo leading-snug font-semibold text-texto @xl/main:text-pf-encabezado">
                          {c.asunto}
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-texto-2">
                          {c.cuerpo}
                        </span>
                      </span>
                      <ChevronRightIcon
                        aria-hidden="true"
                        className="mt-5 size-5 shrink-0 text-texto"
                      />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

          {datos && !error && (
            <div className="rounded-pf-tile border border-pf-divisor bg-superficie">
              <PieLista
                pagina={pagina}
                total={datos.total}
                totalPaginas={datos.total_paginas}
                onCambiarPagina={onPagina}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function ListaFamiliaEscritorio({
  datos,
  error,
  buscar,
  onBuscar,
  noLeidas,
  onNoLeidas,
  orden,
  onOrden,
  pagina,
  onPagina,
  conteos,
  onReintentar,
  base,
}: ListaFamiliaProps) {
  return (
    <>
      <section
        className="relative isolate -mb-6 min-h-[calc(100svh-4rem)]"
        style={{ background: PORTAL_FAMILIA_BACKGROUND }}
      >
        <PortalFamiliaWatermark />
        <div className="relative z-10">
          <PortalFamiliaShell
            titulo="Comunicaciones"
            descripcion="Avisos institucionales y de curso"
            etiqueta="Portal de familia"
            volverA="/familia"
            volverEtiqueta="Volver al inicio"
            className="pb-8"
          />

          <div className="flex w-full flex-col pb-10">
            <div className="overflow-hidden rounded-pf-card bg-superficie shadow-pf-card">
              <div className="flex flex-col gap-4 p-4 @xl/main:p-5 @7xl/main:flex-row @7xl/main:items-center">
                <div className="relative min-w-0 flex-1">
                  <SearchIcon
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-texto-3"
                  />
                  <Input
                    aria-label="Buscar comunicaciones"
                    placeholder="Buscar comunicaciones..."
                    value={buscar}
                    onChange={(event) => onBuscar(event.target.value)}
                    className="h-10 rounded-full border-pf-borde bg-pf-item pl-10 text-pf-cuerpo text-texto placeholder:text-texto-3"
                  />
                </div>

                <div
                  className="flex w-full shrink-0 rounded-full bg-pf-item-hover p-1 @xl/main:w-fit"
                  role="group"
                  aria-label="Filtrar comunicaciones"
                >
                  <button
                    type="button"
                    aria-pressed={!noLeidas}
                    onClick={() => onNoLeidas(false)}
                    className={cn(
                      'min-h-9 flex-1 rounded-full px-4 text-pf-cuerpo font-semibold transition-colors @xl/main:flex-none',
                      !noLeidas ? 'bg-pf-accent text-superficie' : 'text-texto hover:text-texto',
                    )}
                  >
                    Todas ({conteos.todas ?? '—'})
                  </button>
                  <button
                    type="button"
                    aria-pressed={noLeidas}
                    onClick={() => onNoLeidas(true)}
                    className={cn(
                      'min-h-9 flex-1 rounded-full px-4 text-pf-cuerpo font-semibold transition-colors @xl/main:flex-none',
                      noLeidas ? 'bg-pf-accent text-superficie' : 'text-texto hover:text-texto',
                    )}
                  >
                    No leídas ({conteos.noLeidas ?? '—'})
                  </button>
                </div>

                <div className="hidden h-8 w-px shrink-0 bg-pf-divisor @7xl/main:block" />

                <div className="flex items-center justify-between gap-3 @7xl/main:justify-start">
                  <span className="text-sm text-texto">Ordenar por</span>
                  <Select value={orden} onValueChange={(valor) => onOrden(valor as OrdenFecha)}>
                    <SelectTrigger
                      aria-label="Ordenar comunicaciones por fecha"
                      className="h-10 w-full max-w-[230px] rounded-pf-icono border-pf-borde bg-superficie px-3 text-sm font-medium text-texto"
                    >
                      <span className="flex items-center gap-2">
                        <CalendarDaysIcon aria-hidden="true" className="size-4 text-pf-accent" />
                        {orden === 'recientes' ? 'Fecha: más recientes' : 'Fecha: más antiguas'}
                      </span>
                    </SelectTrigger>
                    <SelectContent position="popper" align="end">
                      <SelectItem value="recientes">
                        <ArrowDownIcon aria-hidden="true" />
                        Más recientes primero
                      </SelectItem>
                      <SelectItem value="antiguas">
                        <ArrowUpIcon aria-hidden="true" />
                        Más antiguas primero
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {error ? (
                <div className="px-4 pb-4 @xl/main:px-6">
                  <Alert variant="error">
                    <AlertDescription>
                      No se pudieron cargar las comunicaciones.{' '}
                      <Button variant="secondary" className="rounded-full" onClick={onReintentar}>
                        Reintentar
                      </Button>
                    </AlertDescription>
                  </Alert>
                </div>
              ) : !datos ? (
                <div className="flex flex-col gap-3 px-4 py-6 @xl/main:px-6">
                  {[0, 1, 2].map((fila) => (
                    <Skeleton key={fila} className="h-16 w-full rounded-pf-icono bg-pf-item" />
                  ))}
                </div>
              ) : datos.items.length === 0 ? (
                <p role="status" className="px-6 py-10 text-center text-pf-cuerpo text-texto-2">
                  No hay comunicaciones para mostrar.
                </p>
              ) : (
                <ul className="divide-y divide-pf-divisor">
                  {datos.items.map((c) => {
                    const visual = ESTILOS_TIPO[tipoVisual(c.tipo)]
                    const Icono = visual.Icon
                    return (
                      <li key={c.id}>
                        <Link
                          to={`${base}/${c.id}`}
                          className={cn(
                            'grid grid-cols-[0.5rem_2.5rem_minmax(0,1fr)] items-center gap-4 px-4 py-3.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-pf-accent @xl/main:px-6 @3xl/main:grid-cols-[0.5rem_2.5rem_minmax(0,1fr)_13.5rem_1.25rem]',
                            c.leida_at
                              ? 'bg-superficie hover:bg-pf-item'
                              : 'bg-pf-lila hover:bg-pf-lila-fuerte',
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              'size-2 justify-self-center rounded-full',
                              c.leida_at ? 'bg-transparent' : 'bg-pf-accent',
                            )}
                          />
                          <span
                            className={cn(
                              'flex size-10 items-center justify-center rounded-pf-item',
                              visual.tile,
                            )}
                          >
                            <Icono aria-hidden="true" className="size-5" />
                          </span>
                          <span className="grid min-w-0 gap-1 @xl/main:grid-cols-[8.5rem_minmax(0,1fr)] @xl/main:items-center @xl/main:gap-x-4">
                            <span
                              className={cn(
                                'inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                                visual.pill,
                              )}
                            >
                              {ETIQUETAS_TIPO[c.tipo]}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-heading text-pf-encabezado leading-snug font-semibold text-texto @xl/main:text-pf-encabezado">
                                {c.asunto}
                              </span>
                              <span className="mt-1 block truncate text-sm text-texto-2">
                                {c.cuerpo}
                              </span>
                            </span>
                          </span>
                          <span className="hidden items-center gap-2.5 border-l border-pf-divisor pl-5 text-sm text-texto @3xl/main:flex">
                            <CalendarDaysIcon
                              aria-hidden="true"
                              className="size-4 shrink-0 text-pf-accent"
                            />
                            <span className="whitespace-nowrap">
                              {fechaComunicacion(c.publicada_at ?? c.created_at)}
                            </span>
                          </span>
                          <ChevronRightIcon
                            aria-hidden="true"
                            className="hidden size-4 text-texto-2 @3xl/main:block"
                          />
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}

              {datos && !error && (
                <PieLista
                  pagina={pagina}
                  total={datos.total}
                  totalPaginas={datos.total_paginas}
                  onCambiarPagina={onPagina}
                />
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

/** El listado usa tarjetas en celular y la tabla de escritorio desde lg. */
function useEsMovil(): boolean {
  const [esMovil, setEsMovil] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(max-width: 1023px)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const consulta = window.matchMedia('(max-width: 1023px)')
    const alCambiar = () => setEsMovil(consulta.matches)
    consulta.addEventListener('change', alCambiar)
    return () => consulta.removeEventListener('change', alCambiar)
  }, [])

  return esMovil
}

function ListaFamilia(props: ListaFamiliaProps) {
  const esMovil = useEsMovil()
  return esMovil ? <ListaFamiliaMovil {...props} /> : <ListaFamiliaEscritorio {...props} />
}

export function ComunicacionesPage({
  familia = false,
  docente = false,
}: {
  familia?: boolean
  docente?: boolean
}) {
  const [datos, setDatos] = useState<Listado | null>(null)
  const [buscar, setBuscar] = useState('')
  const [pagina, setPagina] = useState(1)
  const [noLeidas, setNoLeidas] = useState(false)
  const [orden, setOrden] = useState<OrdenFecha>('recientes')
  const [filtro, setFiltro] = useState<FiltroEstado>('todas')
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  const [conteos, setConteos] = useState<Conteos>({ todas: null, noLeidas: null })

  useEffect(() => {
    const controller = new AbortController()
    const estado = filtro === 'todas' ? undefined : filtro
    listarComunicaciones(
      familia,
      pagina,
      buscar,
      noLeidas,
      controller.signal,
      docente,
      estado,
      familia ? 5 : undefined,
      orden,
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setDatos(data)
          setError(false)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
    return () => controller.abort()
  }, [familia, docente, pagina, buscar, noLeidas, filtro, orden, revision])

  useEffect(() => {
    if (!familia) return
    const controller = new AbortController()
    Promise.all([
      listarComunicaciones(true, 1, buscar, false, controller.signal, false, undefined, 1),
      listarComunicaciones(true, 1, buscar, true, controller.signal, false, undefined, 1),
    ])
      .then(([todas, sinLeer]) => {
        if (!controller.signal.aborted) {
          setConteos({ todas: todas.total, noLeidas: sinLeer.total })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setConteos({ todas: null, noLeidas: null })
      })
    return () => controller.abort()
  }, [familia, buscar, revision])

  const base = familia
    ? '/familia/comunicaciones'
    : docente
      ? '/docente/comunicaciones'
      : '/comunicaciones'

  if (familia) {
    return (
      <ListaFamilia
        datos={datos}
        error={error}
        buscar={buscar}
        onBuscar={(valor) => {
          setBuscar(valor)
          setPagina(1)
        }}
        noLeidas={noLeidas}
        onNoLeidas={(valor) => {
          setNoLeidas(valor)
          setPagina(1)
        }}
        orden={orden}
        onOrden={(valor) => {
          setOrden(valor)
          setPagina(1)
        }}
        pagina={pagina}
        onPagina={setPagina}
        conteos={conteos}
        onReintentar={() => setRevision((valor) => valor + 1)}
        base={base}
      />
    )
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <PageHeader
        titulo="Comunicaciones"
        accion={
          <Button asChild>
            <Link to={`${base}/nueva`}>
              <PlusIcon aria-hidden className="size-4" />
              Nueva comunicación
            </Link>
          </Button>
        }
      />
      <p className="text-sm text-texto-2">
        {docente
          ? 'Comunicados para tus cursos asignados y borradores propios.'
          : 'Creá y gestioná las comunicaciones del colegio.'}
      </p>

      <Tabs
        value={filtro}
        onValueChange={(valor) => {
          setFiltro(valor as FiltroEstado)
          setPagina(1)
        }}
      >
        <TabsList>
          <TabsTrigger value="todas">Todas</TabsTrigger>
          <TabsTrigger value="publicada">Publicadas</TabsTrigger>
          <TabsTrigger value="borrador">Borradores</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative min-w-0 flex-1">
          <SearchIcon aria-hidden className="absolute top-2.5 left-3 size-4 text-texto-3" />
          <Input
            aria-label="Buscar comunicaciones"
            className="pl-9"
            value={buscar}
            onChange={(e) => {
              setBuscar(e.target.value)
              setPagina(1)
            }}
          />
        </div>
      </div>

      {error ? (
        <Alert variant="error">
          <AlertDescription>
            No se pudieron cargar las comunicaciones.{' '}
            <Button variant="secondary" onClick={() => setRevision((v) => v + 1)}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : !datos ? (
        <Skeleton className="h-40 w-full" aria-label="Cargando comunicaciones" />
      ) : datos.items.length === 0 ? (
        <p role="status" className="rounded-panel bg-superficie p-8 text-texto-2 shadow-card">
          No hay comunicaciones para mostrar.
        </p>
      ) : (
        <Table minWidth="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead>Asunto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="hidden @5xl/main:table-cell">Canal</TableHead>
              <TableHead>Destinatarios</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="hidden @5xl/main:table-cell">Autor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="font-medium [&_td]:py-3">
            {datos.items.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link
                    className="block max-w-80 truncate font-medium text-violeta hover:text-violeta-esseri focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta"
                    to={c.estado === 'borrador' ? `${base}/${c.id}/editar` : `${base}/${c.id}`}
                    title={c.asunto}
                  >
                    {c.estado === 'borrador' && !c.asunto.trim() ? 'Sin asunto' : c.asunto}
                  </Link>
                </TableCell>
                <TableCell>{ETIQUETAS_TIPO[c.tipo]}</TableCell>
                <TableCell className="hidden @5xl/main:table-cell">
                  <span className="text-texto-2">{ETIQUETAS_CANAL[c.canal ?? 'portal']}</span>
                </TableCell>
                <TableCell>
                  <span className="block max-w-56 truncate">
                    {c.estado === 'borrador'
                      ? 'Por confirmar'
                      : `${etiquetaAudiencia(c)} · ${c.destinatarios}`}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center gap-2 ${c.estado === 'publicada' ? 'text-exito' : 'text-texto-2'}`}
                  >
                    <span
                      aria-hidden="true"
                      className="size-1.5 shrink-0 rounded-full bg-current"
                    />
                    {c.estado === 'publicada' ? 'Publicada' : 'Borrador'}
                  </span>
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatearDiaDeInstante(c.publicada_at ?? c.created_at)}
                </TableCell>
                <TableCell className="hidden text-texto-2 @5xl/main:table-cell">
                  {c.autor_nombre ?? c.emisor ?? '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {datos && !error && (
        <PaginadorServidor
          pagina={pagina}
          tamanioPagina={10}
          total={datos.total}
          totalPaginas={datos.total_paginas}
          onCambiarPagina={setPagina}
          etiqueta="comunicaciones"
        />
      )}
    </section>
  )
}
