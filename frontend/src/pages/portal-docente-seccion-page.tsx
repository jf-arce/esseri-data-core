import { useEffect, useState } from 'react'
import {
  BookOpenCheckIcon,
  CalendarIcon,
  ChevronRightIcon,
  GraduationCapIcon,
  type LucideIcon,
  UserRoundIcon,
} from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Card } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useMisDivisiones } from '@/modules/academico/hooks/use-mis-divisiones'
import type { MiDivision } from '@/modules/academico/types'
import { useCicloLectivoStore } from '@/store/ciclo-lectivo-store'

export type PortalDocenteSeccion = 'cursos' | 'asistencia' | 'alumnos' | 'seguimiento'

const secciones = {
  cursos: {
    titulo: 'Mis cursos',
    descripcion: 'Divisiones asignadas para el ciclo lectivo seleccionado.',
    accion: 'Ver curso',
    icono: BookOpenCheckIcon,
    destino: (division: MiDivision) => `/docente/cursos/${division.division_id}`,
  },
  asistencia: {
    titulo: 'Tomar asistencia',
    descripcion: 'Elegí una división para registrar la asistencia de la clase.',
    accion: 'Tomar asistencia',
    icono: CalendarIcon,
    destino: (division: MiDivision, fecha: string) =>
      `/docente/asistencia/${division.division_id}?fecha=${encodeURIComponent(fecha)}&nombre=${encodeURIComponent(division.etiqueta)}`,
  },
  alumnos: {
    titulo: 'Alumnos',
    descripcion: 'Consultá los alumnos activos de una de tus divisiones.',
    accion: 'Ver alumnos',
    icono: UserRoundIcon,
    destino: (division: MiDivision) => `/docente/cursos/${division.division_id}/alumnos`,
  },
  seguimiento: {
    titulo: 'Seguimiento académico',
    descripcion: 'Consultá los indicadores de asistencia calculados con registros reales.',
    accion: 'Ver seguimiento',
    icono: BookOpenCheckIcon,
    destino: (division: MiDivision) => `/docente/cursos/${division.division_id}/seguimiento`,
  },
} satisfies Record<
  PortalDocenteSeccion,
  {
    titulo: string
    descripcion: string
    accion: string
    icono: LucideIcon
    destino: (division: MiDivision, fecha: string) => string
  }
>

function fechaEnCiclo(cicloLectivo: string): string {
  const hoy = new Date().toISOString().split('T')[0]
  return hoy.startsWith(`${cicloLectivo}-`) ? hoy : `${cicloLectivo}-01-01`
}

export function PortalDocenteSeccionPage({ seccion }: { seccion: PortalDocenteSeccion }) {
  const cicloLectivo = useCicloLectivoStore((state) => state.cicloLectivo)
  const location = useLocation()
  const { divisiones, cargando } = useMisDivisiones(true, cicloLectivo)
  const [fecha, setFecha] = useState(() => fechaEnCiclo(cicloLectivo))
  const config = secciones[seccion]
  const Icono = config.icono

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!fecha.startsWith(`${cicloLectivo}-`)) setFecha(fechaEnCiclo(cicloLectivo))
  }, [cicloLectivo, fecha])
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div className="flex flex-col gap-5">
      <PageHeader titulo={config.titulo} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-sm text-texto-2">
          {config.descripcion} Ciclo lectivo {cicloLectivo}.
        </p>
        {seccion === 'asistencia' && (
          <Field className="w-auto max-w-[220px]">
            <FieldLabel htmlFor="fecha-asistencia-docente">Fecha</FieldLabel>
            <Input
              id="fecha-asistencia-docente"
              type="date"
              value={fecha}
              min={`${cicloLectivo}-01-01`}
              max={`${cicloLectivo}-12-31`}
              onChange={(evento) => setFecha(evento.target.value)}
            />
          </Field>
        )}
      </div>

      {cargando ? (
        <div
          className="overflow-hidden rounded-panel bg-superficie shadow-card"
          aria-label="Cargando cursos"
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse border-b border-borde bg-fila-hover last:border-b-0"
            />
          ))}
        </div>
      ) : divisiones.length === 0 ? (
        <Empty className="min-h-[220px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-sup-academico text-info">
            <GraduationCapIcon />
          </EmptyMedia>
          <EmptyTitle>No hay divisiones asignadas para este ciclo</EmptyTitle>
          <EmptyDescription>
            Cuando coordinación académica te asigne una división vigente, vas a poder consultarla
            acá.
          </EmptyDescription>
        </Empty>
      ) : (
        <Card className="overflow-hidden p-0 shadow-card">
          {divisiones.map((division) => (
            <Link
              key={division.division_id}
              to={config.destino(division, fecha)}
              state={
                seccion === 'asistencia'
                  ? { returnTo: `${location.pathname}${location.search}` }
                  : undefined
              }
              className="flex min-w-0 items-center gap-4 border-b border-borde px-4 py-4 transition-colors last:border-b-0 hover:bg-fila-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violeta sm:px-5"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sup-academico text-info">
                <Icono aria-hidden="true" className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-texto">
                  {division.etiqueta}
                </span>
                <span className="mt-0.5 block truncate text-sm text-texto-2">
                  {division.anio_numero}° año · {division.nivel_educativo_nombre}
                </span>
              </span>
              <span className="hidden text-sm font-medium text-violeta sm:inline">
                {config.accion}
              </span>
              <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-texto-3" />
            </Link>
          ))}
        </Card>
      )}
    </div>
  )
}
