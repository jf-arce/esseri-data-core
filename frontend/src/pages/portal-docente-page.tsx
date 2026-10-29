import { useEffect, useState } from 'react'
import {
  BookOpenCheckIcon,
  CalendarIcon,
  ChevronRightIcon,
  GraduationCapIcon,
  UsersRoundIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import { Card } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useMisDivisiones } from '@/modules/academico/hooks/use-mis-divisiones'
import {
  listarAlumnosDivisionDocente,
  obtenerPerfilDocenteActual,
} from '@/modules/academico/services/docente-academico'
import type { MiDivision } from '@/modules/academico/types'
import { useCicloLectivoStore } from '@/store/ciclo-lectivo-store'

function fechaEnCiclo(cicloLectivo: string): string {
  const hoy = new Date().toISOString().split('T')[0]
  return hoy.startsWith(`${cicloLectivo}-`) ? hoy : `${cicloLectivo}-01-01`
}

function rutaDetalleCurso(division: MiDivision, fecha: string): string {
  return `/docente/cursos/${division.division_id}?fecha=${encodeURIComponent(fecha)}`
}

// Inicio del Portal Docente: resumen real de cursos asignados y acceso al resto del espacio académico.
export function PortalDocentePage() {
  const cicloLectivo = useCicloLectivoStore((state) => state.cicloLectivo)
  const { divisiones, cargando } = useMisDivisiones(true, cicloLectivo)
  const [fecha, setFecha] = useState(() => fechaEnCiclo(cicloLectivo))
  const [nombreDocente, setNombreDocente] = useState<string | null>(null)
  const claveAlumnos = `${cicloLectivo}:${divisiones.map((division) => division.division_id).join(',')}`
  const [resultadoAlumnos, setResultadoAlumnos] = useState<{
    clave: string
    total: number
    error?: boolean
  } | null>(null)
  const estadoAlumnos = resultadoAlumnos?.clave === claveAlumnos ? resultadoAlumnos : null

  useEffect(() => {
    let activo = true
    obtenerPerfilDocenteActual()
      .then((perfil) => {
        if (activo) setNombreDocente(perfil.nombre.trim() || null)
      })
      .catch(() => {
        if (activo) setNombreDocente(null)
      })
    return () => {
      activo = false
    }
  }, [])

  useEffect(() => {
    if (cargando) return
    let activo = true
    Promise.all(
      divisiones.map((division) =>
        listarAlumnosDivisionDocente(division.division_id, cicloLectivo),
      ),
    )
      .then((listados) => {
        if (activo) {
          setResultadoAlumnos({
            clave: claveAlumnos,
            total: listados.reduce((total, listado) => total + listado.total, 0),
          })
        }
      })
      .catch(() => {
        if (activo) setResultadoAlumnos({ clave: claveAlumnos, total: 0, error: true })
      })
    return () => {
      activo = false
    }
  }, [cargando, cicloLectivo, claveAlumnos, divisiones])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!fecha.startsWith(`${cicloLectivo}-`)) setFecha(fechaEnCiclo(cicloLectivo))
  }, [cicloLectivo, fecha])
  /* eslint-enable react-hooks/set-state-in-effect */

  const cursosVisibles = divisiones.slice(0, 3)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-.01em] text-texto">
            {nombreDocente ? `Buen día, ${nombreDocente}` : 'Buen día'}
          </h1>
          <p className="mt-1 text-sm text-texto-2">
            Tus cursos asignados para el ciclo lectivo {cicloLectivo}.
          </p>
        </div>
        <Field className="w-auto max-w-[220px]">
          <FieldLabel htmlFor="fecha-portal-docente">Fecha para tomar asistencia</FieldLabel>
          <Input
            id="fecha-portal-docente"
            type="date"
            value={fecha}
            min={`${cicloLectivo}-01-01`}
            max={`${cicloLectivo}-12-31`}
            onChange={(evento) => setFecha(evento.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="flex min-h-24 flex-row items-center gap-4 p-4 shadow-card">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sup-academico text-info">
            <GraduationCapIcon aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="text-sm text-texto-2">Cursos asignados</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums text-texto">
              {cargando ? '—' : divisiones.length}
            </p>
          </div>
        </Card>
        <Card className="flex min-h-24 flex-row items-center gap-4 p-4 shadow-card">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sup-academico text-info">
            <UsersRoundIcon aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="text-sm text-texto-2">Alumnos a cargo</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums text-texto">
              {cargando || estadoAlumnos === null
                ? '—'
                : estadoAlumnos.error
                  ? '—'
                  : estadoAlumnos.total}
            </p>
            <p className="text-xs text-texto-2">
              {estadoAlumnos?.error
                ? 'No se pudo cargar el total'
                : 'Inscriptos activos en tus cursos'}
            </p>
          </div>
        </Card>
      </div>

      <section id="mis-cursos" className="scroll-mt-24">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-texto">Mis cursos</h2>
            <p className="mt-0.5 text-sm text-texto-2">
              Elegí una división para abrir su espacio académico.
            </p>
          </div>
          {!cargando && divisiones.length > 0 && (
            <Link
              to="/docente/cursos"
              className="shrink-0 text-sm font-medium text-violeta hover:text-violeta-esseri"
            >
              Ver todos
            </Link>
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
          <Empty className="min-h-[240px] rounded-panel bg-superficie shadow-card">
            <EmptyMedia variant="icon" className="bg-sup-academico text-info">
              <GraduationCapIcon />
            </EmptyMedia>
            <EmptyTitle>Todavía no tenés cursos asignados.</EmptyTitle>
            <EmptyDescription>
              Pedile a coordinación académica que te asigne una división para poder consultar sus
              alumnos y asistencias.
            </EmptyDescription>
          </Empty>
        ) : (
          <Card className="overflow-hidden p-0 shadow-card">
            {cursosVisibles.map((division) => (
              <Link
                key={division.division_id}
                to={rutaDetalleCurso(division, fecha)}
                className="flex min-w-0 items-center gap-4 border-b border-borde px-4 py-4 transition-colors last:border-b-0 hover:bg-fila-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violeta sm:px-5"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sup-academico text-info">
                  <BookOpenCheckIcon aria-hidden="true" className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-texto">
                    {division.etiqueta}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-texto-2">
                    {division.anio_numero}° año · {division.nivel_educativo_nombre}
                  </span>
                </span>
                <span className="hidden items-center gap-1.5 text-xs text-texto-2 sm:flex">
                  <CalendarIcon aria-hidden="true" className="size-3.5" />
                  {new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
                <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-texto-3" />
              </Link>
            ))}
          </Card>
        )}
      </section>
    </div>
  )
}
