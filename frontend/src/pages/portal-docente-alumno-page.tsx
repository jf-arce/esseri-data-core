import { useEffect, useState } from 'react'
import { ArrowLeftIcon, BookOpenCheckIcon } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { PageHeader } from '@/components/page-header'
import { StatTile } from '@/components/stat-tile'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAlumnosDivision } from '@/modules/academico/hooks/use-alumnos-division'
import { useHistorialAsistencia } from '@/modules/academico/hooks/use-historial-asistencia'
import { useMisDivisiones } from '@/modules/academico/hooks/use-mis-divisiones'
import { obtenerSeguimientoDivisionDocente } from '@/modules/academico/services/docente-academico'
import type { SeguimientoDivisionItem } from '@/modules/academico/types'
import { etiquetaTipoAsistencia } from '@/modules/academico/utils'
import { useCicloLectivoStore } from '@/store/ciclo-lectivo-store'

function hoyIso(): string {
  return new Date().toISOString().split('T')[0]
}

export function PortalDocenteAlumnoPage() {
  const { divisionId, inscripcionId } = useParams<{ divisionId: string; inscripcionId: string }>()
  const [searchParams] = useSearchParams()
  const cicloSeleccionado = useCicloLectivoStore((state) => state.cicloLectivo)
  const cicloLectivo = searchParams.get('ciclo_lectivo') ?? cicloSeleccionado
  const fechaDesde = `${cicloLectivo}-01-01`
  const fechaHasta =
    cicloLectivo === String(new Date().getFullYear()) ? hoyIso() : `${cicloLectivo}-12-31`
  const { divisiones } = useMisDivisiones(true, cicloLectivo)
  const curso = divisiones.find((division) => division.division_id === divisionId)
  const {
    alumnos,
    cargando: cargandoAlumno,
    sinPermiso,
  } = useAlumnosDivision(divisionId ?? null, { cicloLectivo, portalDocente: true })
  const alumno = alumnos.find((item) => item.id === inscripcionId)
  const {
    historial,
    resumen,
    cargando,
    error,
    sinPermiso: sinPermisoAsistencia,
    recargar,
  } = useHistorialAsistencia(alumno?.id ?? null, fechaDesde, fechaHasta)
  const [resultadoSeguimiento, setResultadoSeguimiento] = useState<{
    clave: string
    item: SeguimientoDivisionItem | null
  } | null>(null)
  const [errorSeguimientoClave, setErrorSeguimientoClave] = useState<string | null>(null)
  const claveSeguimiento = `${divisionId}:${inscripcionId}:${cicloLectivo}`
  const seguimiento =
    resultadoSeguimiento?.clave === claveSeguimiento ? resultadoSeguimiento.item : null
  const errorSeguimiento = errorSeguimientoClave === claveSeguimiento
  const cargandoSeguimiento = resultadoSeguimiento?.clave !== claveSeguimiento && !errorSeguimiento

  useEffect(() => {
    if (!divisionId || !inscripcionId) return
    let activo = true
    obtenerSeguimientoDivisionDocente(divisionId, cicloLectivo)
      .then((items) => {
        if (activo) {
          setResultadoSeguimiento({
            clave: claveSeguimiento,
            item: items.find((item) => item.inscripcion_id === inscripcionId) ?? null,
          })
        }
      })
      .catch(() => {
        if (activo) setErrorSeguimientoClave(claveSeguimiento)
      })
    return () => {
      activo = false
    }
  }, [divisionId, inscripcionId, cicloLectivo, claveSeguimiento])

  const ausencias = resumen
    ? resumen.ausentes_pendientes + resumen.ausentes_justificadas + resumen.ausentes_injustificadas
    : 0
  const hayRegistros = (resumen?.total_registros ?? 0) > 0

  function etiquetaJustificacion(estado: string | null | undefined, tipo: string): string {
    if (estado === 'pendiente') return 'Pendiente'
    if (estado === 'aprobada') return 'Aprobada'
    if (estado === 'rechazada') return 'Rechazada'
    return tipo.startsWith('ausente') ? 'Sin justificación registrada' : '—'
  }
  const detalleCurso = curso
    ? `${curso.etiqueta} · ${curso.anio_numero}° año · ${curso.nivel_educativo_nombre}`
    : null

  if (sinPermiso || sinPermisoAsistencia || (!cargandoAlumno && !alumno)) {
    return (
      <div className="flex flex-col gap-5">
        <Link
          to={`/docente/cursos/${divisionId}/alumnos`}
          className="flex w-fit items-center gap-1.5 text-sm font-semibold text-texto-2 hover:text-texto"
        >
          <ArrowLeftIcon className="size-4" /> Volver a alumnos
        </Link>
        <Empty className="min-h-[220px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-sup-academico text-info">
            <BookOpenCheckIcon />
          </EmptyMedia>
          <EmptyTitle>La ficha académica no está disponible</EmptyTitle>
          <EmptyDescription>
            El alumno no pertenece a una división asignada para el ciclo {cicloLectivo}.
          </EmptyDescription>
        </Empty>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        to={`/docente/cursos/${divisionId}/alumnos`}
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-texto-2 hover:text-texto"
      >
        <ArrowLeftIcon className="size-4" /> Volver a alumnos
      </Link>
      <PageHeader
        titulo={alumno ? `${alumno.alumno_nombre} ${alumno.alumno_apellido}` : 'Ficha académica'}
      />
      <p className="-mt-4 text-sm text-texto-2">
        {alumno
          ? `Legajo ${alumno.numero_legajo} · ${detalleCurso ?? alumno.division_nombre}`
          : 'Cargando datos del alumno…'}
      </p>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-error-suave p-3 text-sm text-error"
        >
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={recargar}>
            Reintentar
          </Button>
        </div>
      )}
      {errorSeguimiento && (
        <p
          role="status"
          className="rounded-lg border border-borde bg-superficie p-3 text-sm text-texto-2"
        >
          No se pudo cargar el indicador de inasistencias reiteradas.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Asistencia"
          value={hayRegistros ? `${resumen?.porcentaje_presencia}%` : '—'}
          icon={BookOpenCheckIcon}
          cargando={cargando}
        />
        <StatTile
          label="Ausencias"
          value={hayRegistros ? ausencias : '—'}
          icon={BookOpenCheckIcon}
          cargando={cargando}
        />
        <StatTile
          label="Tardanzas"
          value={hayRegistros ? (resumen?.tardanzas ?? 0) : '—'}
          icon={BookOpenCheckIcon}
          cargando={cargando}
        />
        <StatTile
          label="Seguimiento"
          value={
            cargandoSeguimiento
              ? '—'
              : errorSeguimiento
                ? 'No disponible'
                : seguimiento?.inasistencia_reiterada
                  ? 'Reiteradas'
                  : 'Sin indicador'
          }
          icon={BookOpenCheckIcon}
          note={
            cargandoSeguimiento
              ? 'Calculando…'
              : errorSeguimiento
                ? 'No disponible'
                : seguimiento
                  ? `${seguimiento.total_ausencias} acumuladas · ${seguimiento.ausencias_consecutivas} consecutivas`
                  : 'Sin registros de asistencia'
          }
        />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-texto">
          Historial de asistencia · {cicloLectivo}
        </h2>
        {cargando ? (
          <div className="h-36 animate-pulse rounded-panel bg-fila-hover" />
        ) : historial.length === 0 ? (
          <Empty className="min-h-[180px] rounded-panel bg-superficie shadow-card">
            <EmptyMedia variant="icon" className="bg-sup-academico text-info">
              <BookOpenCheckIcon />
            </EmptyMedia>
            <EmptyTitle>No hay registros de asistencia</EmptyTitle>
            <EmptyDescription>
              El historial se mostrará cuando existan datos para este ciclo.
            </EmptyDescription>
          </Empty>
        ) : (
          <div className="overflow-hidden rounded-panel border border-borde bg-superficie">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Justificación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historial.map((registro) => (
                  <TableRow key={registro.id}>
                    <TableCell>
                      {new Date(`${registro.fecha}T00:00:00`).toLocaleDateString('es-AR')}
                    </TableCell>
                    <TableCell>{etiquetaTipoAsistencia(registro.tipo)}</TableCell>
                    <TableCell>
                      {etiquetaJustificacion(registro.justificacion_estado, registro.tipo)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}
