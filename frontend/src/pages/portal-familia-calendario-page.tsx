import { ArrowLeftIcon, CalendarDaysIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { HorarioSemanalLectura } from '@/modules/academico/components/horario-semanal-lectura'
import { useHorarioFamilia } from '@/modules/academico/hooks/use-horario-familia'
import { useMisAlumnos } from '@/modules/familias-alumnos/hooks/use-mis-alumnos'

export function PortalFamiliaCalendarioPage() {
  const { alumnos, cargando } = useMisAlumnos(true)
  const [alumnoId, setAlumnoId] = useState('')
  const alumno = alumnos.find((item) => item.alumno_id === alumnoId) ?? alumnos[0]
  const {
    materiasCurso,
    cargando: cargandoHorario,
    error,
  } = useHorarioFamilia(alumno?.alumno_id ?? null)
  const nombre = alumno ? `${alumno.nombre} ${alumno.apellido}` : ''

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <Link
        to="/familia"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-texto-2 hover:text-violeta"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        Volver al inicio
      </Link>
      <header>
        <p className="text-xs font-bold tracking-[.06em] text-texto-3 uppercase">
          Portal de familia
        </p>
        <h1 className="mt-1 font-heading text-2xl font-semibold text-texto">Calendario</h1>
        <p className="mt-1 text-sm text-texto-2">
          El horario semanal de cada alumno a tu cargo, de un vistazo.
        </p>
      </header>

      {cargando ? (
        <Skeleton className="h-80 w-full" />
      ) : alumnos.length === 0 ? (
        <Empty className="min-h-64">
          <EmptyMedia variant="neutral">
            <CalendarDaysIcon />
          </EmptyMedia>
          <EmptyTitle>No encontramos alumnos vinculados</EmptyTitle>
          <EmptyDescription>
            Cuando tu cuenta tenga alumnos a cargo, vas a poder ver acá el calendario de cada uno.
          </EmptyDescription>
        </Empty>
      ) : (
        <Card>
          <CardHeader className="border-b border-borde">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <CardTitle>Horario de {nombre}</CardTitle>
                <CardDescription>
                  {alumno?.division_etiqueta ?? 'Todavía sin división asignada'}
                </CardDescription>
              </div>
              {alumnos.length > 1 && (
                <div className="w-full sm:w-56">
                  <Field>
                    <FieldLabel htmlFor="calendario-alumno">Alumno</FieldLabel>
                    <Select value={alumno?.alumno_id ?? ''} onValueChange={setAlumnoId}>
                      <SelectTrigger id="calendario-alumno" className="w-full">
                        <SelectValue placeholder="Seleccioná un alumno" />
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
              )}
            </div>
          </CardHeader>
          <CardContent>
            {cargandoHorario ? (
              <Skeleton className="h-80 w-full" />
            ) : error ? (
              <p className="rounded-lg border border-dashed border-borde p-4 text-sm text-texto-2">
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
              <HorarioSemanalLectura materiasCurso={materiasCurso} alumno={nombre} />
            )}
          </CardContent>
        </Card>
      )}
    </section>
  )
}
