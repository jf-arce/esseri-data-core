import { Fragment, useMemo, useState } from 'react'
import {
  BookOpenIcon,
  CalculatorIcon,
  CalendarDaysIcon,
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
import { PortalFamiliaShell } from '@/components/portal-familia/portal-familia-shell'
import { PortalCard } from '@/components/portal-familia/portal-familia-ui'
import { useHorarioFamilia } from '@/modules/academico/hooks/use-horario-familia'
import { aMinutos } from '@/modules/academico/utils'
import type { MateriaCurso } from '@/modules/academico/types'
import { useMisAlumnos } from '@/modules/familias-alumnos/hooks/use-mis-alumnos'
import { normalizarTexto } from '@/lib/texto'
import { cn } from '@/lib/utils'

const FONDO_CALENDARIO =
  'linear-gradient(180deg, rgba(74,58,99,0) 0%, rgba(74,58,99,0) 150px, #F3EDF9 320px, #F6F1FA 100%)'

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

function claveCelda(franja: Franja): string {
  return `${franja.dia_semana}-${franja.hora_inicio}-${franja.hora_fin}`
}

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
  const docente = franja.materia.docentes?.join(', ') || 'Sin docente asignado'

  return (
    <div className="flex flex-col gap-5">
      <div className={cn('flex items-center gap-4 rounded-[16px] px-4 py-4', estilo.bg)}>
        <span
          className={cn(
            'flex size-14 shrink-0 items-center justify-center rounded-[14px] bg-white/70',
            estilo.texto,
          )}
        >
          <Icono aria-hidden="true" className="size-7" />
        </span>
        <p className="font-heading text-[24px] leading-tight font-bold text-[#241A33]">
          {franja.materia.materia_nombre}
        </p>
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
  const [alumnoId, setAlumnoId] = useState('')
  const [seleccionId, setSeleccionId] = useState<string | null>(null)
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

  const slots = useMemo(() => {
    const unicos = new Map<string, { inicio: string; fin: string }>()
    for (const franja of franjas) {
      const clave = `${franja.hora_inicio}-${franja.hora_fin}`
      if (!unicos.has(clave)) {
        unicos.set(clave, { inicio: franja.hora_inicio, fin: franja.hora_fin })
      }
    }
    return [...unicos.values()].sort((a, b) => aMinutos(a.inicio) - aMinutos(b.inicio))
  }, [franjas])

  const celdas = useMemo(() => {
    const mapa = new Map<string, Franja>()
    for (const franja of franjas) mapa.set(claveCelda(franja), franja)
    return mapa
  }, [franjas])

  const primeraFranja = useMemo(
    () =>
      [...franjas].sort(
        (a, b) => a.dia_semana - b.dia_semana || aMinutos(a.hora_inicio) - aMinutos(b.hora_inicio),
      )[0] ?? null,
    [franjas],
  )

  const activa = franjas.find((franja) => franja.id === seleccionId) ?? primeraFranja
  const diaActivo = activa?.dia_semana

  return (
    <section
      className="relative -mx-4 -mb-6 min-h-[calc(100svh-4rem)] overflow-hidden sm:-mx-8"
      style={{ background: FONDO_CALENDARIO }}
    >
      <div className="relative z-10">
        <PortalFamiliaShell
          icono={<CalendarDaysIcon aria-hidden="true" className="size-8" />}
          titulo="Calendario"
          descripcion="Consultá el horario semanal de cada alumno a tu cargo."
          etiqueta="Portal de familia"
          volverA="/familia"
          volverEtiqueta="Volver al inicio"
          anchoMaximo="max-w-[1500px]"
          className="pb-8"
        />

        <div className="mx-auto w-full max-w-[1500px] px-4 pb-10 sm:px-8">
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
                          setSeleccionId(null)
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
                  <div className="overflow-x-auto">
                    <div className="min-w-[820px]">
                      <div
                        className="grid overflow-hidden rounded-[18px] border border-[#EFE7F6] bg-white"
                        style={{
                          gridTemplateColumns: '8rem repeat(5, minmax(0, 1fr))',
                        }}
                      >
                        <div className="bg-[#FBF9FD]" aria-hidden="true" />
                        {DIAS.map((dia) => (
                          <div
                            key={dia}
                            className={cn(
                              'border-l border-[#EFE7F6] px-3 py-3 text-center text-[15px] font-semibold',
                              dia === diaActivo
                                ? 'bg-[#F1E4FB] text-[#7A2FA8]'
                                : 'bg-[#FBF9FD] text-[#2B2338]',
                            )}
                          >
                            {NOMBRES_DIA[dia - 1]}
                          </div>
                        ))}

                        {slots.map((slot) => (
                          <Fragment key={`${slot.inicio}-${slot.fin}`}>
                            <div className="border-t border-[#EFE7F6] px-3 py-4 text-center text-[13px] font-semibold text-[#6B6478] tabular-nums">
                              {rangoHora(slot.inicio)} – {rangoHora(slot.fin)}
                            </div>
                            {DIAS.map((dia) => {
                              const franja = celdas.get(`${dia}-${slot.inicio}-${slot.fin}`)
                              if (!franja) {
                                return (
                                  <div
                                    key={`${dia}-${slot.inicio}`}
                                    className="min-h-[72px] border-t border-l border-[#EFE7F6]"
                                  />
                                )
                              }
                              const estilo = estiloMateria(franja.materia.materia_nombre)
                              const Icono = estilo.Icono
                              const activaEsta = franja.id === activa?.id
                              return (
                                <div
                                  key={`${dia}-${slot.inicio}`}
                                  className="border-t border-l border-[#EFE7F6] p-2"
                                >
                                  <button
                                    type="button"
                                    aria-pressed={activaEsta}
                                    onClick={() => setSeleccionId(franja.id)}
                                    className={cn(
                                      'flex min-h-[60px] w-full flex-col justify-center gap-1 rounded-[12px] px-3 py-2 text-left transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A2FA8]',
                                      estilo.bg,
                                      activaEsta &&
                                        'ring-2 ring-[#7A2FA8] ring-offset-2 ring-offset-white',
                                    )}
                                  >
                                    <span className="flex items-center gap-2">
                                      <Icono
                                        aria-hidden="true"
                                        className={cn('size-[18px] shrink-0', estilo.texto)}
                                      />
                                      <span className="min-w-0 text-[13.5px] leading-tight font-bold text-[#2B2338]">
                                        {franja.materia.materia_nombre}
                                      </span>
                                    </span>
                                    <span className="text-[12px] font-medium text-[#4B4456] tabular-nums">
                                      {rangoHora(franja.hora_inicio)} – {rangoHora(franja.hora_fin)}
                                    </span>
                                  </button>
                                </div>
                              )
                            })}
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </PortalCard>

              <PortalCard
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
