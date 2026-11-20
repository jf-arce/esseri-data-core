import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, UserRoundIcon } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { ExportarHorario } from '@/modules/academico/components/exportar-horario'
import { HorarioImprimible } from '@/modules/academico/components/horario-imprimible'
import { FiltrosHorario } from '@/modules/academico/components/filtros-horario'
import {
  compartirHorarioFamilia,
  descargarHorarioFamilia,
} from '@/modules/academico/services/exportar-horario'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldLabel } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  PORTAL_FAMILIA_BACKGROUND,
  PortalFamiliaShell,
} from '@/components/portal-familia/portal-familia-shell'
import { PortalFamiliaWatermark } from '@/components/portal-familia/portal-familia-watermark'
import { PortalCard } from '@/components/portal-familia/portal-familia-ui'
import { useHorarioFamilia } from '@/modules/academico/hooks/use-horario-familia'
import { GrillaSemanal, type Actividad } from '@/modules/academico/components/grilla-semanal'
import { GrupoActividadesSheet } from '@/modules/academico/components/grupo-actividades-sheet'
import { DetalleMateria } from '@/modules/academico/components/detalle-materia'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  aMinutos,
  coincideFiltroHorario,
  FILTRO_HORARIO_INICIAL,
  hayFiltroHorario,
  type FiltroHorario,
} from '@/modules/academico/utils'
import { rangoVisible } from '@/modules/academico/utils-calendario'
import { estiloMateria } from '@/modules/academico/estilos-materia'
import type { MateriaCurso } from '@/modules/academico/types'
import { useMisAlumnos } from '@/modules/familias-alumnos/hooks/use-mis-alumnos'
import { EventoDetalleSheet } from '@/modules/comunicaciones/components/evento-detalle-sheet'
import { EventosCalendarioFamilia } from '@/modules/comunicaciones/components/eventos-calendario-familia'
import { useEventosFamilia } from '@/modules/comunicaciones/hooks/use-eventos-familia'
import type { EventoCalendario } from '@/modules/comunicaciones/types'
import { useCicloLectivoStore } from '@/store/ciclo-lectivo-store'
import { cn } from '@/lib/utils'

const DIAS = [1, 2, 3, 4, 5]
const INICIO_GRILLA = 7 * 60 + 30
const FIN_GRILLA = 16 * 60 + 30
const NOMBRES_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

function rangoHora(hora: string): string {
  return hora.slice(0, 5)
}

type Franja = MateriaCurso['horarios'][number] & { materia: MateriaCurso }

export function PortalFamiliaCalendarioPage() {
  const { alumnos, cargando } = useMisAlumnos(true)
  const cicloLectivo = useCicloLectivoStore((s) => s.cicloLectivo)
  const [searchParams] = useSearchParams()
  const [alumnoId, setAlumnoId] = useState(() => searchParams.get('alumno') ?? '')
  const [diaAgenda, setDiaAgenda] = useState<number | null>(null)
  const [seleccionId, setSeleccionId] = useState<string | null>(null)
  const [claseMovil, setClaseMovil] = useState<Franja | null>(null)
  const [filtro, setFiltro] = useState<FiltroHorario>(FILTRO_HORARIO_INICIAL)
  const [semanaOffset, setSemanaOffset] = useState(0)
  const [eventoSeleccionado, setEventoSeleccionado] = useState<EventoCalendario | null>(null)
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<Actividad[] | null>(null)
  const alumno = alumnos.find((item) => item.alumno_id === alumnoId) ?? alumnos[0]
  const {
    materiasCurso,
    cargando: cargandoHorario,
    error,
  } = useHorarioFamilia(alumno?.alumno_id ?? null)

  const franjas = useMemo<Franja[]>(
    () =>
      materiasCurso.flatMap((materia) =>
        materia.horarios.map((horario) => ({ ...horario, materia })),
      ),
    [materiasCurso],
  )

  const docentesDisponibles = useMemo(
    () =>
      [...new Set(materiasCurso.flatMap((materia) => materia.docentes ?? []))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [materiasCurso],
  )
  const franjasFiltradas = useMemo(
    () =>
      franjas.filter((franja) =>
        coincideFiltroHorario(franja.materia, filtro, franja.materia.docentes ?? []),
      ),
    [franjas, filtro],
  )
  const diaVisible = diaAgenda ?? 1
  const semana = useMemo(() => {
    const hoy = new Date()
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7) + semanaOffset * 7)
    return DIAS.map((dia) => {
      const fecha = new Date(lunes)
      fecha.setDate(lunes.getDate() + dia - 1)
      return fecha
    })
  }, [semanaOffset])
  const hoyISO = new Date().toDateString()
  const formateoCorto = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' })
  const etiquetaSemana = `${formateoCorto.format(semana[0])} – ${formateoCorto.format(semana[4])}`
  const domingo = new Date(semana[0])
  domingo.setDate(domingo.getDate() + 6)
  const claveFecha = (fecha: Date) =>
    `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
  const desdeSemana = claveFecha(semana[0])
  const hastaSemana = claveFecha(domingo)
  const {
    eventos,
    cargando: cargandoEventos,
    error: errorEventos,
  } = useEventosFamilia(alumno?.alumno_id ?? null, desdeSemana, hastaSemana)

  const actividades = useMemo<Actividad[]>(() => {
    const clases = franjasFiltradas.map<Actividad>((franja) => ({
      tipo: 'clase',
      id: `clase-${franja.id}`,
      dia: franja.dia_semana,
      inicio: aMinutos(franja.hora_inicio),
      fin: aMinutos(franja.hora_fin),
      franja,
    }))
    const deEventos = eventos.flatMap<Actividad>((evento) => {
      if (!evento.hora_inicio && !evento.hora_fin) return []
      const fecha = new Date(`${evento.fecha}T00:00:00`)
      const dia = ((fecha.getDay() + 6) % 7) + 1
      const inicio = evento.hora_inicio ? aMinutos(evento.hora_inicio) : 0
      const fin = evento.hora_fin ? aMinutos(evento.hora_fin) : Math.min(24 * 60, inicio + 60)
      return [
        {
          tipo: 'evento',
          id: `evento-${evento.comunicacion_id}`,
          dia,
          inicio,
          fin: Math.max(fin, inicio + 15),
          evento,
        },
      ]
    })
    return [...clases, ...deEventos]
  }, [franjasFiltradas, eventos])

  const rango = useMemo(
    () =>
      rangoVisible(
        INICIO_GRILLA,
        FIN_GRILLA,
        actividades.map(({ inicio, fin }) => ({ inicio, fin })),
      ),
    [actividades],
  )

  const solapan = (a: { inicio: number; fin: number }, b: { inicio: number; fin: number }) =>
    a.inicio < b.fin && b.inicio < a.fin

  const coincidenciasDe = useCallback(
    (evento: EventoCalendario | null) => {
      if (!evento) return []
      const propio = actividades.find(
        (actividad) =>
          actividad.tipo === 'evento' &&
          actividad.evento.comunicacion_id === evento.comunicacion_id,
      )
      if (!propio) return []
      return actividades
        .filter(
          (actividad) =>
            actividad !== propio &&
            actividad.dia === propio.dia &&
            solapan(actividad, propio) &&
            actividad.tipo === 'clase',
        )
        .map((actividad) => ({
          actividad,
          detalle:
            actividad.tipo === 'clase'
              ? `${actividad.franja.hora_inicio.slice(0, 5)} a ${actividad.franja.hora_fin.slice(0, 5)}`
              : '',
        }))
    },
    [actividades],
  )
  useEffect(() => {
    const raiz = document.documentElement
    const antes = () => {
      if (raiz.classList.contains('dark')) {
        raiz.dataset.temaOscuroImpresion = '1'
        raiz.classList.remove('dark')
      }
    }
    const despues = () => {
      if (raiz.dataset.temaOscuroImpresion) {
        raiz.classList.add('dark')
        delete raiz.dataset.temaOscuroImpresion
      }
    }
    window.addEventListener('beforeprint', antes)
    window.addEventListener('afterprint', despues)
    return () => {
      window.removeEventListener('beforeprint', antes)
      window.removeEventListener('afterprint', despues)
      despues()
    }
  }, [])

  const franjasDelDia = useMemo(
    () =>
      franjasFiltradas
        .filter((franja) => franja.dia_semana === diaVisible)
        .sort((a, b) => aMinutos(a.hora_inicio) - aMinutos(b.hora_inicio)),
    [franjasFiltradas, diaVisible],
  )

  function elegirDia(dia: number) {
    setDiaAgenda(dia)
  }

  return (
    <section
      className="relative isolate -mb-6 min-h-[calc(100svh-4rem)]"
      style={{ background: PORTAL_FAMILIA_BACKGROUND }}
    >
      <PortalFamiliaWatermark />
      <div className="relative z-10">
        <PortalFamiliaShell
          titulo="Calendario"
          descripcion="Consultá el horario semanal de cada alumno a tu cargo."
          etiqueta="Portal de familia"
          volverA="/familia"
          volverEtiqueta="Volver al inicio"
          className="pb-8 print:hidden"
        />

        <div className="zona-impresion w-full pb-10 print:max-w-none print:p-0">
          {cargando ? (
            <Skeleton className="h-96 w-full rounded-pf-card bg-superficie/80" />
          ) : alumnos.length === 0 ? (
            <PortalCard contentClassName="p-8">
              <Empty className="min-h-64">
                <EmptyMedia variant="neutral">
                  <CalendarDaysIcon />
                </EmptyMedia>
                <EmptyTitle>No encontramos alumnos vinculados</EmptyTitle>
                <EmptyDescription>
                  Cuando tu cuenta tenga alumnos a cargo, vas a poder ver acá el calendario de cada
                  uno.
                </EmptyDescription>
              </Empty>
            </PortalCard>
          ) : (
            <div className="flex flex-col gap-4">
              <PortalCard
                className="print:hidden"
                titulo="Horario semanal"
                descripcion={alumno?.division_etiqueta ?? 'Todavía sin división asignada'}
                tituloClassName="font-heading text-pf-encabezado font-semibold text-texto"
                headerClassName="border-b border-pf-divisor px-5 pt-5 pb-4"
                contentClassName="px-4 pt-5 pb-5"
                accion={
                  <div className="w-full sm:w-64">
                    <Field>
                      <FieldLabel htmlFor="calendario-alumno">Alumno</FieldLabel>
                      <Select
                        value={alumno?.alumno_id ?? ''}
                        onValueChange={(valor) => {
                          setAlumnoId(valor)
                          setDiaAgenda(null)
                          setSeleccionId(null)
                        }}
                      >
                        <SelectTrigger
                          id="calendario-alumno"
                          className="h-10 w-full rounded-pf-item border-pf-borde bg-superficie text-pf-cuerpo"
                        >
                          <span className="flex items-center gap-2">
                            <UserRoundIcon aria-hidden="true" className="size-4 text-texto-2" />
                            <SelectValue placeholder="Seleccioná un alumno" />
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {alumnos.map((item) => (
                            <SelectItem key={item.alumno_id} value={item.alumno_id}>
                              {item.nombre} {item.apellido}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                }
              >
                {cargandoHorario ? (
                  <Skeleton className="h-80 w-full rounded-pf-tile bg-pf-item" />
                ) : error ? (
                  <p className="rounded-pf-tile border border-dashed border-pf-borde bg-pf-item p-4 text-sm text-texto-2">
                    No pudimos cargar el calendario de este alumno. Probá de nuevo en unos minutos.
                  </p>
                ) : materiasCurso.length === 0 ? (
                  <Empty className="min-h-56">
                    <EmptyMedia variant="neutral">
                      <CalendarDaysIcon />
                    </EmptyMedia>
                    <EmptyTitle>Todavía no hay materias cargadas</EmptyTitle>
                    <EmptyDescription>
                      Cuando el colegio cargue el horario del curso, las materias van a aparecer
                      acá.
                    </EmptyDescription>
                  </Empty>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-pf-divisor px-4 py-3 print:hidden">
                      <div className="flex flex-wrap items-center gap-1">
                        <Button
                          variant="secondary"
                          size="icon"
                          aria-label="Semana anterior"
                          onClick={() => {
                            setSeleccionId(null)
                            setSemanaOffset((valor) => valor - 1)
                          }}
                        >
                          <ChevronLeftIcon aria-hidden="true" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="rounded-full"
                          disabled={semanaOffset === 0}
                          onClick={() => setSemanaOffset(0)}
                        >
                          Semana actual
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          aria-label="Semana siguiente"
                          onClick={() => {
                            setSeleccionId(null)
                            setSemanaOffset((valor) => valor + 1)
                          }}
                        >
                          <ChevronRightIcon aria-hidden="true" />
                        </Button>
                        <span className="ml-2 text-sm font-medium text-texto-2">
                          Semana del {etiquetaSemana}
                        </span>
                      </div>
                      <ExportarHorario
                        titulo="Horario semanal"
                        descargar={
                          alumno ? () => descargarHorarioFamilia(alumno.alumno_id) : undefined
                        }
                        compartir={
                          alumno
                            ? () => compartirHorarioFamilia(alumno.alumno_id, 'Horario semanal')
                            : undefined
                        }
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-b border-pf-divisor px-4 py-3 print:hidden">
                      <FiltrosHorario
                        filtro={filtro}
                        onFiltro={setFiltro}
                        docentes={docentesDisponibles}
                      />
                    </div>

                    {hayFiltroHorario(filtro) && franjasFiltradas.length === 0 && (
                      <p className="mx-4 mt-4 rounded-pf-item border border-dashed border-pf-borde bg-pf-item p-4 text-sm text-texto-2">
                        No hay clases que coincidan con los filtros.
                      </p>
                    )}

                    <div data-testid="calendario-grilla" className="hidden lg:block">
                      <GrillaSemanal
                        semana={semana}
                        hoyISO={hoyISO}
                        rango={rango}
                        actividades={actividades}
                        claseAbiertaId={seleccionId}
                        onSeleccionarClase={(franja) => setSeleccionId(franja?.id ?? null)}
                        onSeleccionarEvento={setEventoSeleccionado}
                        onVerGrupo={setGrupoSeleccionado}
                      />
                    </div>
                    <div data-testid="calendario-agenda" className="flex flex-col gap-4 lg:hidden">
                      <div
                        role="tablist"
                        aria-label="Día del calendario"
                        className="flex flex-wrap gap-1 rounded-pf-card bg-pf-item-hover p-1"
                      >
                        {DIAS.map((dia) => (
                          <button
                            key={dia}
                            type="button"
                            role="tab"
                            aria-selected={dia === diaVisible}
                            onClick={() => elegirDia(dia)}
                            className={cn(
                              'min-h-10 flex-1 rounded-full px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-pf-accent focus-visible:ring-offset-2',
                              dia === diaVisible
                                ? 'bg-superficie text-pf-accent shadow-sm'
                                : 'text-texto-2 hover:text-texto',
                            )}
                          >
                            {NOMBRES_DIA[dia - 1]}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-col gap-2">
                        {franjasDelDia.length === 0 ? (
                          <p className="rounded-pf-item border border-dashed border-pf-borde bg-pf-item p-4 text-sm text-texto-2">
                            No hay clases este día.
                          </p>
                        ) : (
                          franjasDelDia.map((franja) => {
                            const estilo = estiloMateria(franja.materia.materia_nombre)
                            const Icono = estilo.Icono
                            const color = franja.materia.materia_color || 'var(--pf-accent)'
                            const docentes = franja.materia.docentes ?? []
                            const docente =
                              docentes.length > 1
                                ? `Profesores: ${docentes.join(', ')}`
                                : docentes.length === 1
                                  ? `Profesor: ${docentes[0]}`
                                  : 'Sin docente'
                            return (
                              <button
                                type="button"
                                key={franja.id}
                                aria-label={`${franja.materia.materia_nombre ?? 'Materia'}: ver detalle`}
                                onClick={() => setClaseMovil(franja)}
                                className="flex items-center gap-3 rounded-pf-icono px-4 py-3 text-left transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-accent"
                                style={{
                                  backgroundColor: `color-mix(in srgb, ${color} 20%, var(--superficie))`,
                                  border: `1px solid color-mix(in srgb, ${color} 45%, var(--borde))`,
                                }}
                              >
                                <span
                                  className="flex size-10 shrink-0 items-center justify-center rounded-pf-input bg-superficie/70"
                                  style={{ color }}
                                >
                                  <Icono aria-hidden="true" className="size-5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-pf-cuerpo font-bold text-texto">
                                    {franja.materia.materia_nombre}
                                  </span>
                                  <span className="mt-0.5 block text-sm font-medium text-texto-2 tabular-nums">
                                    {rangoHora(franja.hora_inicio)} – {rangoHora(franja.hora_fin)}
                                  </span>
                                  <span className="mt-0.5 block text-sm font-medium text-texto-2">
                                    {docente}
                                  </span>
                                </span>
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </>
                )}
                {alumno && (
                  <EventosCalendarioFamilia
                    eventos={eventos}
                    cargando={cargandoEventos}
                    error={errorEventos}
                    etiquetaSemana={`Semana del ${formateoCorto.format(semana[0])} al ${formateoCorto.format(domingo)}`}
                    onVerEvento={setEventoSeleccionado}
                    coincidenciasPorEvento={(evento) => coincidenciasDe(evento).length}
                    navegacion={
                      !cargandoHorario && (error || materiasCurso.length === 0) ? (
                        <div className="flex flex-wrap items-center gap-2 print:hidden">
                          <Button
                            variant="secondary"
                            size="icon"
                            aria-label="Semana anterior"
                            onClick={() => {
                              setSeleccionId(null)
                              setSemanaOffset((valor) => valor - 1)
                            }}
                          >
                            <ChevronLeftIcon aria-hidden="true" />
                          </Button>
                          <span className="text-sm">{`${formateoCorto.format(semana[0])} – ${formateoCorto.format(domingo)}`}</span>
                          <Button
                            variant="secondary"
                            size="icon"
                            aria-label="Semana siguiente"
                            onClick={() => {
                              setSeleccionId(null)
                              setSemanaOffset((valor) => valor + 1)
                            }}
                          >
                            <ChevronRightIcon aria-hidden="true" />
                          </Button>
                        </div>
                      ) : undefined
                    }
                  />
                )}
              </PortalCard>
            </div>
          )}

          {alumno && (
            <div className="hidden print:block" aria-hidden="true">
              <HorarioImprimible
                franjas={franjas}
                division={alumno.division_etiqueta ?? ''}
                cicloLectivo={cicloLectivo}
              />
            </div>
          )}
        </div>
      </div>

      <EventoDetalleSheet
        evento={eventoSeleccionado}
        coincidencias={coincidenciasDe(eventoSeleccionado).map(({ actividad, detalle }) => ({
          id: actividad.id,
          titulo:
            actividad.tipo === 'clase'
              ? (actividad.franja.materia.materia_nombre ?? 'Materia')
              : actividad.evento.titulo,
          detalle,
          tipo: 'clase' as const,
        }))}
        onCerrar={() => setEventoSeleccionado(null)}
      />

      <Sheet open={claseMovil !== null} onOpenChange={(abierto) => !abierto && setClaseMovil(null)}>
        <SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto rounded-t-[24px]">
          {claseMovil && (
            <>
              <SheetHeader className="sr-only">
                <SheetTitle>{claseMovil.materia.materia_nombre}</SheetTitle>
                <SheetDescription>Detalle de la materia seleccionada</SheetDescription>
              </SheetHeader>
              <DetalleMateria
                franja={claseMovil}
                fecha={semana[claseMovil.dia_semana - 1]}
                variante="hoja"
              />
            </>
          )}
        </SheetContent>
      </Sheet>

      <GrupoActividadesSheet
        actividades={grupoSeleccionado}
        onCerrar={() => setGrupoSeleccionado(null)}
        onVerActividad={(actividad) => {
          setGrupoSeleccionado(null)
          if (actividad.tipo === 'clase') setSeleccionId(actividad.franja.id)
          else setEventoSeleccionado(actividad.evento)
        }}
      />
    </section>
  )
}
