import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  BookOpenIcon,
  CalculatorIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  EarthIcon,
  FlaskConicalIcon,
  GlobeIcon,
  LaptopIcon,
  LeafIcon,
  MusicIcon,
  PaletteIcon,
  UserRoundIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { ExportarHorario } from '@/modules/academico/components/exportar-horario'
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
import {
  aMinutos,
  coincideFiltroHorario,
  FILTRO_HORARIO_INICIAL,
  hayFiltroHorario,
  type FiltroHorario,
} from '@/modules/academico/utils'
import type { MateriaCurso } from '@/modules/academico/types'
import { useMisAlumnos } from '@/modules/familias-alumnos/hooks/use-mis-alumnos'
import { EventosCalendarioFamilia } from '@/modules/comunicaciones/components/eventos-calendario-familia'
import { normalizarTexto } from '@/lib/texto'
import { cn } from '@/lib/utils'

const DIAS = [1, 2, 3, 4, 5]
const INICIO_GRILLA = 7 * 60 + 30
const FIN_GRILLA = 16 * 60 + 30
const FILAS_GRILLA = (FIN_GRILLA - INICIO_GRILLA) / 30
const NOMBRES_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

type EstiloMateria = { bg: string; texto: string; Icono: LucideIcon }

const ESTILOS_MATERIA: Record<string, EstiloMateria> = {
  lengua: { bg: 'bg-[#E8F1FE]', texto: 'text-[#2563EB]', Icono: BookOpenIcon },
  matematica: { bg: 'bg-[#E3F6F1]', texto: 'text-[#0D9488]', Icono: CalculatorIcon },
  'ciencias naturales': { bg: 'bg-[#EAF7E7]', texto: 'text-[#16A34A]', Icono: LeafIcon },
  'ciencias sociales': { bg: 'bg-[#FBF3DC]', texto: 'text-[#CA8A04]', Icono: EarthIcon },
  ingles: { bg: 'bg-[#F1E9FD]', texto: 'text-[#7C3AED]', Icono: GlobeIcon },
  'educacion fisica': { bg: 'bg-[#FDEEE3]', texto: 'text-[#EA580C]', Icono: FlaskConicalIcon },
  musica: { bg: 'bg-[#FCE9F2]', texto: 'text-[#DB2777]', Icono: MusicIcon },
  plastica: { bg: 'bg-[#E4F6FA]', texto: 'text-[#0891B2]', Icono: PaletteIcon },
  'taller de arte': { bg: 'bg-[#F3E8FF]', texto: 'text-[#7C3AED]', Icono: PaletteIcon },
  tecnologia: { bg: 'bg-[#E8EDFD]', texto: 'text-[#4F46E5]', Icono: LaptopIcon },
}

const ESTILO_POR_DEFECTO: EstiloMateria = {
  bg: 'bg-[#F3EDF9]',
  texto: 'text-[#7A2FA8]',
  Icono: BookOpenIcon,
}

function estiloMateria(nombre: string | null): EstiloMateria {
  return ESTILOS_MATERIA[normalizarTexto(nombre ?? '')] ?? ESTILO_POR_DEFECTO
}

function rangoHora(hora: string): string {
  return hora.slice(0, 5)
}

type Franja = MateriaCurso['horarios'][number] & { materia: MateriaCurso }

function DetalleClase({ franja }: { franja: Franja | null }) {
  if (!franja) {
    return (
      <p className="py-6 text-center text-sm text-[#6B6478]">
        Seleccioná una clase de la grilla para ver su detalle.
      </p>
    )
  }
  const estilo = estiloMateria(franja.materia.materia_nombre)
  const Icono = estilo.Icono
  const docentes = franja.materia.docentes ?? []
  const docente = docentes.length > 0 ? docentes.join(', ') : 'Sin docente'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4 rounded-[16px] bg-fila-hover px-4 py-4">
        <span
          className="flex size-14 shrink-0 items-center justify-center rounded-[14px] bg-white/70"
          style={{ color: franja.materia.materia_color || '#7A2FA8' }}
        >
          <Icono aria-hidden="true" className="size-7" />
        </span>
        <p className="font-heading text-[24px] leading-tight font-bold text-[#241A33]">
          {franja.materia.materia_nombre}
        </p>
      </div>

      <div className="flex items-start gap-3.5 border-t border-[#F1EBF7] pt-5">
        <CalendarDaysIcon aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-[#6B6478]" />
        <div>
          <p className="text-[14px] text-[#6B6478]">Día</p>
          <p className="text-[18px] font-semibold text-[#2B2338]">
            {NOMBRES_DIA[franja.dia_semana - 1] ?? '—'}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3.5 border-t border-[#F1EBF7] pt-5">
        <ClockIcon aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-[#6B6478]" />
        <div>
          <p className="text-[14px] text-[#6B6478]">Horario</p>
          <p className="text-[18px] font-semibold text-[#2B2338]">
            {rangoHora(franja.hora_inicio)} – {rangoHora(franja.hora_fin)}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3.5 border-t border-[#F1EBF7] pt-5">
        <UserRoundIcon aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-[#6B6478]" />
        <div>
          <p className="text-[14px] text-[#6B6478]">Docente</p>
          <p className="text-[18px] font-semibold text-[#2B2338]">{docente}</p>
        </div>
      </div>
    </div>
  )
}

export function PortalFamiliaCalendarioPage() {
  const { alumnos, cargando } = useMisAlumnos(true)
  const [searchParams] = useSearchParams()
  const [alumnoId, setAlumnoId] = useState(() => searchParams.get('alumno') ?? '')
  const [diaAgenda, setDiaAgenda] = useState<number | null>(null)
  const [seleccionId, setSeleccionId] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<FiltroHorario>(FILTRO_HORARIO_INICIAL)
  const [semanaOffset, setSemanaOffset] = useState(0)
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
  const primeraFranja = useMemo(
    () =>
      [...franjasFiltradas].sort(
        (a, b) => a.dia_semana - b.dia_semana || aMinutos(a.hora_inicio) - aMinutos(b.hora_inicio),
      )[0] ?? null,
    [franjasFiltradas],
  )
  const activa = franjasFiltradas.find((franja) => franja.id === seleccionId) ?? primeraFranja
  const diaActivo = activa?.dia_semana
  const diaVisible = diaAgenda ?? diaActivo ?? 1
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
    const primera = franjasFiltradas
      .filter((franja) => franja.dia_semana === dia)
      .sort((a, b) => aMinutos(a.hora_inicio) - aMinutos(b.hora_inicio))[0]
    if (primera) setSeleccionId(primera.id)
  }

  return (
    <section
      className="relative isolate -mx-4 -mb-6 min-h-[calc(100svh-4rem)] overflow-hidden sm:-mx-8"
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
          anchoMaximo="max-w-[92vw]"
          className="pb-8 print:hidden"
          classNameContenido="px-4 sm:px-8"
        />

        <div className="zona-impresion mx-auto w-full max-w-[92vw] px-4 pb-10 sm:px-8 print:max-w-none print:p-0">
          {cargando ? (
            <Skeleton className="h-96 w-full rounded-[24px] bg-white/80" />
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
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
              <PortalCard
                className="print:border-0 print:shadow-none"
                titulo="Horario semanal"
                descripcion={alumno?.division_etiqueta ?? 'Todavía sin división asignada'}
                tituloClassName="font-heading text-[26px] leading-tight font-bold tracking-[-0.01em] text-[#241A33]"
                headerClassName="border-b border-[#F1EBF7] px-6 pt-6 pb-6"
                contentClassName="px-6 pt-6 pb-6"
                accion={
                  <div className="w-full sm:w-64">
                    <Field>
                      <FieldLabel htmlFor="calendario-alumno">Alumno</FieldLabel>
                      <Select
                        value={alumno?.alumno_id ?? ''}
                        onValueChange={(valor) => {
                          setAlumnoId(valor)
                          setDiaAgenda(null)
                        }}
                      >
                        <SelectTrigger
                          id="calendario-alumno"
                          className="h-11 w-full rounded-[12px] border-[#E7DDF1] bg-white text-[15px]"
                        >
                          <span className="flex items-center gap-2">
                            <UserRoundIcon aria-hidden="true" className="size-4 text-[#6B6478]" />
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
                  <Skeleton className="h-80 w-full rounded-[16px] bg-[#F3EDF9]" />
                ) : error ? (
                  <p className="rounded-[16px] border border-dashed border-[#E4D9F0] bg-[#FBF9FD] p-4 text-sm text-[#6B6478]">
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
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F1EBF7] px-4 py-3 print:hidden">
                      <div className="flex flex-wrap items-center gap-1">
                        <Button
                          variant="secondary"
                          size="icon"
                          aria-label="Semana anterior"
                          onClick={() => setSemanaOffset((valor) => valor - 1)}
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
                          onClick={() => setSemanaOffset((valor) => valor + 1)}
                        >
                          <ChevronRightIcon aria-hidden="true" />
                        </Button>
                        <span className="ml-2 text-[14px] font-medium text-[#6B6478]">
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

                    <div className="flex flex-wrap items-center gap-2 border-b border-[#F1EBF7] px-4 py-3 print:hidden">
                      <FiltrosHorario
                        filtro={filtro}
                        onFiltro={setFiltro}
                        docentes={docentesDisponibles}
                      />
                    </div>

                    {hayFiltroHorario(filtro) && franjasFiltradas.length === 0 && (
                      <p className="mx-4 mt-4 rounded-[12px] border border-dashed border-[#E4D9F0] bg-[#FBF9FD] p-4 text-sm text-[#6B6478]">
                        No hay clases que coincidan con los filtros.
                      </p>
                    )}

                    <div data-testid="calendario-grilla" className="hidden lg:block">
                      <div className="overflow-x-auto">
                        <div className="min-w-[820px] print:min-w-0">
                          <div
                            className="grid overflow-hidden rounded-[18px] border border-[#EFE7F6] bg-white"
                            style={{
                              gridTemplateColumns: '8rem repeat(5, minmax(0, 1fr))',
                              gridTemplateRows: `auto repeat(${FILAS_GRILLA}, minmax(30px, 1fr))`,
                            }}
                          >
                            <div className="bg-[#FBF9FD]" aria-hidden="true" />
                            {DIAS.map((dia) => (
                              <div
                                key={dia}
                                className={cn(
                                  'border-l border-[#EFE7F6] px-3 py-2 text-center text-[14px] font-semibold',
                                  dia === diaActivo
                                    ? 'bg-[#F1E4FB] text-[#7A2FA8]'
                                    : 'bg-[#FBF9FD] text-[#2B2338]',
                                )}
                              >
                                <span className="block">{NOMBRES_DIA[dia - 1]}</span>
                                <span className="block text-[12px] font-normal opacity-70">
                                  {semana[dia - 1].getDate()}
                                  {semana[dia - 1].toDateString() === hoyISO ? ' · Hoy' : ''}
                                </span>
                              </div>
                            ))}

                            {Array.from(
                              { length: FILAS_GRILLA },
                              (_, indice) => INICIO_GRILLA + indice * 30,
                            ).map((minutos, indice) => (
                              <Fragment key={minutos}>
                                <div
                                  className="border-t border-[#EFE7F6] px-3 text-center text-[12px] font-semibold text-[#6B6478] tabular-nums"
                                  style={{ gridRow: indice + 2, gridColumn: 1 }}
                                >
                                  {`${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`}
                                </div>
                                {DIAS.map((dia) => (
                                  <div
                                    key={dia}
                                    className="border-t border-l border-[#EFE7F6]"
                                    style={{ gridRow: indice + 2, gridColumn: dia + 1 }}
                                  />
                                ))}
                              </Fragment>
                            ))}

                            {franjasFiltradas.map((franja) => {
                              const inicio = aMinutos(franja.hora_inicio)
                              const fin = aMinutos(franja.hora_fin)
                              const filaInicio = Math.max(
                                0,
                                Math.round((inicio - INICIO_GRILLA) / 30),
                              )
                              const filaFin = Math.min(
                                FILAS_GRILLA,
                                Math.max(filaInicio + 1, Math.round((fin - INICIO_GRILLA) / 30)),
                              )
                              const estilo = estiloMateria(franja.materia.materia_nombre)
                              const Icono = estilo.Icono
                              const color = franja.materia.materia_color || '#7A2FA8'
                              const activaEsta = franja.id === activa?.id
                              return (
                                <button
                                  key={franja.id}
                                  type="button"
                                  aria-pressed={activaEsta}
                                  onClick={() => setSeleccionId(franja.id)}
                                  style={{
                                    gridRow: `${filaInicio + 2} / ${filaFin + 2}`,
                                    gridColumn: franja.dia_semana + 1,
                                    backgroundColor: `color-mix(in srgb, ${color} 20%, var(--superficie))`,
                                    border: `1px solid color-mix(in srgb, ${color} 45%, var(--borde))`,
                                    boxShadow: activaEsta ? `0 0 0 2px ${color}` : undefined,
                                  }}
                                  className={cn(
                                    'relative z-10 m-1 flex flex-col justify-center gap-0.5 rounded-[10px] px-2.5 py-1.5 text-left transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A2FA8]',
                                  )}
                                >
                                  <span className="flex items-center gap-1.5">
                                    <Icono
                                      aria-hidden="true"
                                      className="size-4 shrink-0"
                                      style={{ color }}
                                    />
                                    <span className="min-w-0 text-[13px] leading-tight font-bold text-[#2B2338]">
                                      {franja.materia.materia_nombre}
                                    </span>
                                  </span>
                                  <span className="text-[11px] font-medium text-[#4B4456] tabular-nums">
                                    {rangoHora(franja.hora_inicio)} – {rangoHora(franja.hora_fin)}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div data-testid="calendario-agenda" className="flex flex-col gap-4 lg:hidden">
                      <div
                        role="tablist"
                        aria-label="Día del calendario"
                        className="flex flex-wrap gap-1 rounded-[20px] bg-[#F5EFFA] p-1"
                      >
                        {DIAS.map((dia) => (
                          <button
                            key={dia}
                            type="button"
                            role="tab"
                            aria-selected={dia === diaVisible}
                            onClick={() => elegirDia(dia)}
                            className={cn(
                              'min-h-10 flex-1 rounded-full px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-[#7A2FA8] focus-visible:ring-offset-2',
                              dia === diaVisible
                                ? 'bg-white text-[#7A2FA8] shadow-sm'
                                : 'text-[#6B6478] hover:text-[#2B2338]',
                            )}
                          >
                            {NOMBRES_DIA[dia - 1]}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-col gap-2">
                        {franjasDelDia.length === 0 ? (
                          <p className="rounded-[12px] border border-dashed border-[#E4D9F0] bg-[#FBF9FD] p-4 text-sm text-[#6B6478]">
                            No hay clases este día.
                          </p>
                        ) : (
                          franjasDelDia.map((franja) => {
                            const estilo = estiloMateria(franja.materia.materia_nombre)
                            const Icono = estilo.Icono
                            const color = franja.materia.materia_color || '#7A2FA8'
                            const docentes = franja.materia.docentes ?? []
                            const docente =
                              docentes.length > 1
                                ? `Profesores: ${docentes.join(', ')}`
                                : docentes.length === 1
                                  ? `Profesor: ${docentes[0]}`
                                  : 'Sin docente'
                            return (
                              <div
                                key={franja.id}
                                className="flex items-center gap-3 rounded-[14px] px-4 py-3 text-left"
                                style={{
                                  backgroundColor: `color-mix(in srgb, ${color} 20%, var(--superficie))`,
                                  border: `1px solid color-mix(in srgb, ${color} 45%, var(--borde))`,
                                }}
                              >
                                <span
                                  className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-white/70"
                                  style={{ color }}
                                >
                                  <Icono aria-hidden="true" className="size-5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[15px] font-bold text-[#2B2338]">
                                    {franja.materia.materia_nombre}
                                  </span>
                                  <span className="mt-0.5 block text-[13px] font-medium text-[#4B4456] tabular-nums">
                                    {rangoHora(franja.hora_inicio)} – {rangoHora(franja.hora_fin)}
                                  </span>
                                  <span className="mt-0.5 block text-[13px] font-medium text-[#4B4456]">
                                    {docente}
                                  </span>
                                </span>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </>
                )}
                {alumno && (
                  <EventosCalendarioFamilia
                    alumnoId={alumno.alumno_id}
                    desde={claveFecha(semana[0])}
                    hasta={claveFecha(domingo)}
                    navegacion={
                      !cargandoHorario && (error || materiasCurso.length === 0) ? (
                        <div className="flex flex-wrap items-center gap-2 print:hidden">
                          <Button
                            variant="secondary"
                            size="icon"
                            aria-label="Semana anterior"
                            onClick={() => setSemanaOffset((valor) => valor - 1)}
                          >
                            <ChevronLeftIcon aria-hidden="true" />
                          </Button>
                          <span className="text-sm">{`${formateoCorto.format(semana[0])} – ${formateoCorto.format(domingo)}`}</span>
                          <Button
                            variant="secondary"
                            size="icon"
                            aria-label="Semana siguiente"
                            onClick={() => setSemanaOffset((valor) => valor + 1)}
                          >
                            <ChevronRightIcon aria-hidden="true" />
                          </Button>
                        </div>
                      ) : undefined
                    }
                  />
                )}
              </PortalCard>

              <PortalCard
                className="hidden xl:block print:hidden"
                titulo="Detalle de clase"
                tituloClassName="font-heading text-[24px] leading-tight font-bold text-[#241A33]"
                headerClassName="px-6 pt-6 pb-5"
                contentClassName="px-6 pt-1 pb-6"
              >
                <DetalleClase franja={activa} />
              </PortalCard>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
