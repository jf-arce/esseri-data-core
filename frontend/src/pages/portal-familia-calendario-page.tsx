import { Fragment, useMemo, useState } from 'react'
import {
  BookOpenIcon,
  CalculatorIcon,
  CalendarDaysIcon,
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
import { aMinutos, deMinutos } from '@/modules/academico/utils'
import type { MateriaCurso } from '@/modules/academico/types'
import { useMisAlumnos } from '@/modules/familias-alumnos/hooks/use-mis-alumnos'
import { normalizarTexto } from '@/lib/texto'
import { cn } from '@/lib/utils'

const DIAS = [1, 2, 3, 4, 5]
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

export function PortalFamiliaCalendarioPage() {
  const { alumnos, cargando } = useMisAlumnos(true)
  const [searchParams] = useSearchParams()
  const [alumnoId, setAlumnoId] = useState(() => searchParams.get('alumno') ?? '')
  const [diaAgenda, setDiaAgenda] = useState<number | null>(null)
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

  const puntos = useMemo(() => {
    const unicos = new Set<number>()
    for (const franja of franjas) {
      unicos.add(aMinutos(franja.hora_inicio))
      unicos.add(aMinutos(franja.hora_fin))
    }
    return [...unicos].sort((a, b) => a - b)
  }, [franjas])

  const filasHorario = useMemo(() => {
    const intervalos = puntos
      .slice(0, -1)
      .map((inicio, indice) => ({ inicio, fin: puntos[indice + 1] }))
    return intervalos.filter(({ inicio, fin }) =>
      franjas.some(
        (franja) => aMinutos(franja.hora_inicio) <= inicio && aMinutos(franja.hora_fin) >= fin,
      ),
    )
  }, [puntos, franjas])

  const diaVisible = diaAgenda ?? 1
  const franjasDelDia = useMemo(
    () =>
      franjas
        .filter((franja) => franja.dia_semana === diaVisible)
        .sort((a, b) => aMinutos(a.hora_inicio) - aMinutos(b.hora_inicio)),
    [franjas, diaVisible],
  )

  function elegirDia(dia: number) {
    setDiaAgenda(dia)
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
          className="pb-8"
          classNameContenido="px-4 sm:px-8"
        />

        <div className="mx-auto w-full max-w-[92vw] px-4 pb-10 sm:px-8">
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
            <PortalCard
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
                    Cuando el colegio cargue el horario del curso, las materias van a aparecer acá.
                  </EmptyDescription>
                </Empty>
              ) : (
                <>
                  <div data-testid="calendario-grilla" className="hidden lg:block">
                    <div className="overflow-x-auto">
                      <div className="min-w-[820px]">
                        <div
                          className="grid overflow-hidden rounded-[18px] border border-[#EFE7F6] bg-white"
                          style={{
                            gridTemplateColumns: '8rem repeat(5, minmax(0, 1fr))',
                            gridTemplateRows: `auto ${filasHorario
                              .map(
                                (fila) =>
                                  `minmax(78px, ${Math.max(1, (fila.fin - fila.inicio) / 60)}fr)`,
                              )
                              .join(' ')}`,
                          }}
                        >
                          <div className="bg-[#FBF9FD]" aria-hidden="true" />
                          {DIAS.map((dia) => (
                            <div
                              key={dia}
                              className="border-l border-[#EFE7F6] bg-[#FBF9FD] px-3 py-3 text-center text-[15px] font-semibold text-[#2B2338]"
                            >
                              {NOMBRES_DIA[dia - 1]}
                            </div>
                          ))}

                          {filasHorario.map((fila, indice) => (
                            <Fragment key={`${fila.inicio}-${fila.fin}`}>
                              <div
                                className="border-t border-[#EFE7F6] px-3 py-4 text-center text-[13px] font-semibold text-[#6B6478] tabular-nums"
                                style={{ gridRow: indice + 2, gridColumn: 1 }}
                              >
                                {deMinutos(fila.inicio)} – {deMinutos(fila.fin)}
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

                          {franjas.map((franja) => {
                            const inicio = aMinutos(franja.hora_inicio)
                            const fin = aMinutos(franja.hora_fin)
                            const filaInicio = filasHorario.findIndex(
                              (fila) => fila.inicio === inicio,
                            )
                            const filaFin = filasHorario.findIndex((fila) => fila.fin === fin)
                            if (filaInicio === -1 || filaFin === -1) return null
                            const estilo = estiloMateria(franja.materia.materia_nombre)
                            const Icono = estilo.Icono
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
                                style={{
                                  gridRow: `${filaInicio + 2} / ${filaFin + 3}`,
                                  gridColumn: franja.dia_semana + 1,
                                }}
                                className={cn(
                                  'relative z-10 m-1 flex flex-col justify-center gap-0.5 rounded-[12px] px-2.5 py-1.5 text-left',
                                  estilo.bg,
                                )}
                              >
                                <span className="flex items-center gap-1.5">
                                  <Icono
                                    aria-hidden="true"
                                    className={cn('size-4 shrink-0', estilo.texto)}
                                  />
                                  <span className="min-w-0 text-[13px] leading-tight font-bold text-[#2B2338]">
                                    {franja.materia.materia_nombre}
                                  </span>
                                </span>
                                <span className="text-[11px] font-medium text-[#4B4456] tabular-nums">
                                  {rangoHora(franja.hora_inicio)} – {rangoHora(franja.hora_fin)}
                                </span>
                                <span className="line-clamp-2 text-[11px] leading-tight font-medium text-[#4B4456]">
                                  {docente}
                                </span>
                              </div>
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
                              className={cn(
                                'flex items-center gap-3 rounded-[14px] px-4 py-3 text-left',
                                estilo.bg,
                              )}
                            >
                              <span
                                className={cn(
                                  'flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-white/70',
                                  estilo.texto,
                                )}
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
            </PortalCard>
          )}
        </div>
      </div>
    </section>
  )
}
