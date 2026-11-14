import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisIcon,
  MegaphoneIcon,
  PlusIcon,
  SearchIcon,
  UsersIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { PaginadorServidor } from '@/components/paginador-servidor'
import { PortalFamiliaShell } from '@/components/portal-familia/portal-familia-shell'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
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
    pill: 'bg-[#EFE0FA] text-[#7A2FA8]',
    tile: 'bg-[#F1E4FB] text-[#7A2FA8]',
    Icon: MegaphoneIcon,
  },
  curso: {
    pill: 'bg-[#DFEAFB] text-[#3B6FB6]',
    tile: 'bg-[#E8F0FD] text-[#4F86D9]',
    Icon: UsersIcon,
  },
  otro: {
    pill: 'bg-[#E4F1E3] text-[#3E7B45]',
    tile: 'bg-[#EDF6EC] text-[#4F8F46]',
    Icon: EllipsisIcon,
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
    <div className="flex flex-col gap-3 border-t border-[#F1EBF7] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <p className="text-[14px] text-[#3A2E45]">
        {primera}–{ultima} de {total} comunicaciones
      </p>
      {totalPaginas > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Ir a la página anterior"
            disabled={pagina === 1}
            onClick={() => onCambiarPagina(pagina - 1)}
            className="flex size-9 items-center justify-center rounded-[10px] border border-[#EDE4F4] text-[#2B2338] transition-colors hover:bg-[#F7F2FC] disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeftIcon aria-hidden="true" className="size-4" />
          </button>
          {paginasVisibles(totalPaginas, pagina).map((item, indice) =>
            item === 'elipsis' ? (
              <span key={`elipsis-${indice}`} className="px-1 text-sm text-[#6B6478]">
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
                  'size-9 rounded-[10px] text-sm font-semibold tabular-nums transition-colors',
                  item === pagina ? 'bg-[#7A2FA8] text-white' : 'text-[#3A2E45] hover:bg-[#F5EFFA]',
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
            className="flex size-9 items-center justify-center rounded-[10px] border border-[#EDE4F4] text-[#2B2338] transition-colors hover:bg-[#F7F2FC] disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRightIcon aria-hidden="true" className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}

function ListaFamilia({
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
        className="relative -mx-4 -mb-6 min-h-[calc(100svh-4rem)] overflow-hidden sm:-mx-8"
        style={{
          background:
            'linear-gradient(180deg, rgba(74,58,99,0) 0%, rgba(74,58,99,0) 150px, #F3EDF9 320px, #F6F1FA 100%)',
        }}
      >
        <div className="relative z-10">
          <PortalFamiliaShell
            icono={<MegaphoneIcon aria-hidden="true" className="size-8" />}
            titulo="Comunicaciones"
            descripcion="Avisos institucionales y de curso"
            etiqueta="Portal de familia"
            anchoMaximo="max-w-[92vw]"
            className="pb-8"
          />

          <div className="mx-auto flex w-full max-w-[92vw] flex-col px-4 pb-10 sm:px-8">
            <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_18px_50px_rgba(57,34,84,0.12)]">
              <div className="flex flex-col gap-4 p-4 sm:p-5 xl:flex-row xl:items-center">
                <div className="relative min-w-0 flex-1">
                  <SearchIcon
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[#8C8599]"
                  />
                  <Input
                    aria-label="Buscar comunicaciones"
                    placeholder="Buscar comunicaciones..."
                    value={buscar}
                    onChange={(event) => onBuscar(event.target.value)}
                    className="h-12 rounded-full border-[#E7DDF1] bg-[#FBF9FE] pl-12 text-[15px] text-[#2B2338] placeholder:text-[#8C8599]"
                  />
                </div>

                <div
                  className="flex w-full shrink-0 rounded-full bg-[#F5EFFA] p-1 sm:w-fit"
                  role="group"
                  aria-label="Filtrar comunicaciones"
                >
                  <button
                    type="button"
                    aria-pressed={!noLeidas}
                    onClick={() => onNoLeidas(false)}
                    className={cn(
                      'min-h-10 flex-1 rounded-full px-5 text-[15px] font-semibold transition-colors sm:flex-none',
                      !noLeidas
                        ? 'bg-[#7A2FA8] text-white shadow-[0_4px_12px_rgba(122,47,168,0.25)]'
                        : 'text-[#3A2E45] hover:text-[#2B2338]',
                    )}
                  >
                    Todas ({conteos.todas ?? '—'})
                  </button>
                  <button
                    type="button"
                    aria-pressed={noLeidas}
                    onClick={() => onNoLeidas(true)}
                    className={cn(
                      'min-h-10 flex-1 rounded-full px-5 text-[15px] font-semibold transition-colors sm:flex-none',
                      noLeidas
                        ? 'bg-[#7A2FA8] text-white shadow-[0_4px_12px_rgba(122,47,168,0.25)]'
                        : 'text-[#3A2E45] hover:text-[#2B2338]',
                    )}
                  >
                    No leídas ({conteos.noLeidas ?? '—'})
                  </button>
                </div>

                <div className="hidden h-8 w-px shrink-0 bg-[#EDE4F4] xl:block" />

                <div className="flex items-center justify-between gap-3 xl:justify-start">
                  <span className="text-[14px] text-[#3A2E45]">Ordenar por</span>
                  <Select value={orden} onValueChange={(valor) => onOrden(valor as OrdenFecha)}>
                    <SelectTrigger
                      aria-label="Ordenar comunicaciones por fecha"
                      className="h-11 w-[230px] rounded-[14px] border-[#E7DDF1] bg-white px-3 text-[14px] font-medium text-[#2B2338]"
                    >
                      <span className="flex items-center gap-2">
                        <CalendarDaysIcon
                          aria-hidden="true"
                          className="size-[18px] text-[#7A2FA8]"
                        />
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
                <div className="px-4 pb-4 sm:px-6">
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
                <div className="flex flex-col gap-3 px-4 py-6 sm:px-6">
                  {[0, 1, 2].map((fila) => (
                    <Skeleton key={fila} className="h-16 w-full rounded-[14px] bg-[#F3EDF9]" />
                  ))}
                </div>
              ) : datos.items.length === 0 ? (
                <p role="status" className="px-6 py-10 text-center text-[15px] text-[#6B6478]">
                  No hay comunicaciones para mostrar.
                </p>
              ) : (
                <ul className="divide-y divide-[#F1EBF7]">
                  {datos.items.map((c) => {
                    const visual = ESTILOS_TIPO[tipoVisual(c.tipo)]
                    const Icono = visual.Icon
                    return (
                      <li key={c.id}>
                        <Link
                          to={`${base}/${c.id}`}
                          className={cn(
                            'grid grid-cols-[0.5rem_3rem_minmax(0,1fr)] items-center gap-4 px-4 py-4.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7A2FA8] sm:px-6 md:grid-cols-[0.5rem_3rem_minmax(0,1fr)_13.5rem_1.25rem]',
                            c.leida_at
                              ? 'bg-white hover:bg-[#FAF7FD]'
                              : 'bg-[#F7F0FC] hover:bg-[#F2E8FA]',
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              'size-2 justify-self-center rounded-full',
                              c.leida_at ? 'bg-transparent' : 'bg-[#7A2FA8]',
                            )}
                          />
                          <span
                            className={cn(
                              'flex size-12 items-center justify-center rounded-[14px]',
                              visual.tile,
                            )}
                          >
                            <Icono aria-hidden="true" className="size-6" />
                          </span>
                          <span className="grid min-w-0 gap-1 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:items-center sm:gap-x-4">
                            <span
                              className={cn(
                                'inline-flex w-fit items-center rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.06em] uppercase',
                                visual.pill,
                              )}
                            >
                              {ETIQUETAS_TIPO[c.tipo]}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-heading text-[19px] leading-snug font-bold text-[#241A33] sm:text-[20px]">
                                {c.asunto}
                              </span>
                              <span className="mt-1 block truncate text-[14px] text-[#6B6478]">
                                {c.cuerpo}
                              </span>
                            </span>
                          </span>
                          <span className="hidden items-center gap-2.5 border-l border-[#EDE4F4] pl-5 text-[14px] text-[#3A2E45] md:flex">
                            <CalendarDaysIcon
                              aria-hidden="true"
                              className="size-[18px] shrink-0 text-[#7A2FA8]"
                            />
                            <span className="whitespace-nowrap">
                              {fechaComunicacion(c.publicada_at ?? c.created_at)}
                            </span>
                          </span>
                          <ChevronRightIcon
                            aria-hidden="true"
                            className="hidden size-5 text-[#2B2338] md:block"
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
        <div className="overflow-x-auto rounded-panel bg-superficie shadow-card">
          <Table minWidth="min-w-[1080px]">
            <TableHeader>
              <TableRow>
                <TableHead>Asunto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Destinatarios</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Autor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="font-medium [&_td]:py-3">
              {datos.items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      className="font-medium text-violeta hover:text-violeta-esseri focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta"
                      to={c.estado === 'borrador' ? `${base}/${c.id}/editar` : `${base}/${c.id}`}
                    >
                      {c.asunto}
                    </Link>
                  </TableCell>
                  <TableCell>{ETIQUETAS_TIPO[c.tipo]}</TableCell>
                  <TableCell>
                    <span className="text-texto-2">{ETIQUETAS_CANAL[c.canal ?? 'portal']}</span>
                  </TableCell>
                  <TableCell>
                    {c.estado === 'borrador'
                      ? 'Por confirmar'
                      : `${etiquetaAudiencia(c)} · ${c.destinatarios}`}
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
                  <TableCell className="text-texto-2">
                    {c.autor_nombre ?? c.emisor ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
