import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeftIcon,
  BookOpenCheckIcon,
  CalendarIcon,
  GraduationCapIcon,
  UserRoundIcon,
} from 'lucide-react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { ApiError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { PageHeader } from '@/components/page-header'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAlumnosDivision } from '@/modules/academico/hooks/use-alumnos-division'
import { useMisDivisiones } from '@/modules/academico/hooks/use-mis-divisiones'
import { listarAsistencias } from '@/modules/academico/services/asistencias'
import { obtenerSeguimientoDivisionDocente } from '@/modules/academico/services/docente-academico'
import type { Asistencia, SeguimientoDivisionItem } from '@/modules/academico/types'
import { useCicloLectivoStore } from '@/store/ciclo-lectivo-store'

function fechaEnCiclo(cicloLectivo: string): string {
  const hoy = new Date().toISOString().split('T')[0]
  return hoy.startsWith(`${cicloLectivo}-`) ? hoy : `${cicloLectivo}-01-01`
}

function fechaLocalISO(fecha: Date): string {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

function obtenerRangoUltimosTreintaDias() {
  const hasta = new Date()
  const desde = new Date(hasta)
  desde.setDate(desde.getDate() - 29)
  return { desde: fechaLocalISO(desde), hasta: fechaLocalISO(hasta) }
}

type ConteoDiarioAsistencia = {
  fecha: string
  presentes: number
  tardanzas: number
  ausencias: number
}

function agruparAsistenciasPorDia(asistencias: Asistencia[]): ConteoDiarioAsistencia[] {
  const rango = obtenerRangoUltimosTreintaDias()
  const conteos = new Map<string, ConteoDiarioAsistencia>()

  for (const asistencia of asistencias) {
    if (asistencia.fecha < rango.desde || asistencia.fecha > rango.hasta) continue
    const conteo = conteos.get(asistencia.fecha) ?? {
      fecha: asistencia.fecha,
      presentes: 0,
      tardanzas: 0,
      ausencias: 0,
    }
    if (asistencia.tipo === 'presente') conteo.presentes += 1
    else if (asistencia.tipo === 'tardanza') conteo.tardanzas += 1
    else if (asistencia.tipo.startsWith('ausente_')) conteo.ausencias += 1
    conteos.set(asistencia.fecha, conteo)
  }

  return [...conteos.values()].sort((a, b) => a.fecha.localeCompare(b.fecha))
}

function etiquetaFechaGrafico(fecha: string): string {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
  })
}

type VistaCurso = 'resumen' | 'alumnos' | 'seguimiento'

export function PortalDocenteCursoPage({ vista = 'resumen' }: { vista?: VistaCurso }) {
  const { divisionId } = useParams<{ divisionId: string }>()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const cicloLectivo = useCicloLectivoStore((state) => state.cicloLectivo)
  const { divisiones, cargando: cargandoCursos } = useMisDivisiones(true, cicloLectivo)
  const curso = divisiones.find((division) => division.division_id === divisionId)
  const { alumnos, cargando, error, sinPermiso } = useAlumnosDivision(divisionId ?? null, {
    cicloLectivo,
    portalDocente: true,
  })
  const claveSeguimiento = `${divisionId}:${cicloLectivo}`
  const [resultadoSeguimiento, setResultadoSeguimiento] = useState<{
    clave: string
    items: SeguimientoDivisionItem[]
    error?: string
  } | null>(null)
  const estadoSeguimiento =
    resultadoSeguimiento?.clave === claveSeguimiento ? resultadoSeguimiento : null
  const seguimiento = useMemo(() => estadoSeguimiento?.items ?? [], [estadoSeguimiento?.items])
  const errorSeguimiento = estadoSeguimiento?.error
  const cargandoSeguimiento = estadoSeguimiento === null
  const claveAsistencias = `${divisionId}:${cicloLectivo}`
  const [resultadoAsistencias, setResultadoAsistencias] = useState<{
    clave: string
    items: Asistencia[]
    error?: string
  } | null>(null)
  const estadoAsistencias =
    resultadoAsistencias?.clave === claveAsistencias ? resultadoAsistencias : null
  const asistencias = useMemo(() => estadoAsistencias?.items ?? [], [estadoAsistencias?.items])
  const errorAsistencias = estadoAsistencias?.error
  const cargandoAsistencias = estadoAsistencias === null

  useEffect(() => {
    if (!divisionId) return
    let activo = true
    obtenerSeguimientoDivisionDocente(divisionId, cicloLectivo)
      .then((items) => {
        if (activo) setResultadoSeguimiento({ clave: claveSeguimiento, items })
      })
      .catch((err: unknown) => {
        if (activo) {
          setResultadoSeguimiento({
            clave: claveSeguimiento,
            items: [],
            error:
              err instanceof ApiError
                ? (err.detail ?? 'No se pudo cargar el seguimiento académico.')
                : 'No se pudo cargar el seguimiento académico.',
          })
        }
      })
    return () => {
      activo = false
    }
  }, [divisionId, cicloLectivo, claveSeguimiento])

  useEffect(() => {
    if (!divisionId) return
    let activo = true
    listarAsistencias({ division_id: divisionId, ciclo_lectivo: cicloLectivo })
      .then((items) => {
        if (activo) setResultadoAsistencias({ clave: claveAsistencias, items })
      })
      .catch((err: unknown) => {
        if (activo) {
          setResultadoAsistencias({
            clave: claveAsistencias,
            items: [],
            error:
              err instanceof ApiError
                ? (err.detail ?? 'No se pudieron cargar las asistencias del curso.')
                : 'No se pudieron cargar las asistencias del curso.',
          })
        }
      })
    return () => {
      activo = false
    }
  }, [divisionId, cicloLectivo, claveAsistencias])

  const seguimientoPorInscripcion = useMemo(
    () => new Map(seguimiento.map((item) => [item.inscripcion_id, item] as const)),
    [seguimiento],
  )
  const asistenciaPorInscripcion = useMemo(() => {
    const conteos = new Map<string, { total: number; asistencias: number }>()
    for (const asistencia of asistencias) {
      const conteo = conteos.get(asistencia.inscripcion_id) ?? { total: 0, asistencias: 0 }
      conteo.total += 1
      if (asistencia.tipo === 'presente' || asistencia.tipo === 'tardanza') {
        conteo.asistencias += 1
      }
      conteos.set(asistencia.inscripcion_id, conteo)
    }
    const porcentajes = new Map<string, number>()
    for (const [inscripcionId, conteo] of conteos) {
      porcentajes.set(inscripcionId, Math.round((conteo.asistencias / conteo.total) * 100))
    }
    return porcentajes
  }, [asistencias])
  const diasGrafico = useMemo(() => agruparAsistenciasPorDia(asistencias), [asistencias])
  const maximoGrafico = Math.max(
    1,
    ...diasGrafico.flatMap((dia) => [dia.presentes, dia.ausencias, dia.tardanzas]),
  )
  const fechaSolicitada = searchParams.get('fecha')
  const fecha = fechaSolicitada?.startsWith(`${cicloLectivo}-`)
    ? fechaSolicitada
    : fechaEnCiclo(cicloLectivo)
  const fechaFormateada = new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
  })
  const totalAusenciasCurso = seguimiento.reduce((total, item) => total + item.total_ausencias, 0)
  const alumnosConSeguimiento = alumnos
    .map((alumno) => ({ alumno, indicador: seguimientoPorInscripcion.get(alumno.id) }))
    .filter((item) => item.indicador?.inasistencia_reiterada)
  const totalAlumnosConSeguimiento = alumnosConSeguimiento.length
  const titulo =
    vista === 'alumnos'
      ? 'Alumnos del curso'
      : vista === 'seguimiento'
        ? 'Seguimiento académico'
        : (curso?.etiqueta ?? 'Curso')
  const rutaVolver =
    vista === 'alumnos'
      ? '/docente/alumnos'
      : vista === 'seguimiento'
        ? '/docente/seguimiento'
        : '/docente/cursos'
  const textoVolver =
    vista === 'alumnos' ? 'Alumnos' : vista === 'seguimiento' ? 'Seguimiento' : 'Mis cursos'

  if (sinPermiso || (curso === undefined && !cargandoCursos)) {
    return (
      <div className="flex flex-col gap-5">
        <Link
          to={rutaVolver}
          className="flex w-fit items-center gap-1.5 text-sm font-semibold text-texto-2 hover:text-texto"
        >
          <ArrowLeftIcon className="size-4" /> {textoVolver}
        </Link>
        <Empty className="min-h-[240px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-sup-academico text-info">
            <GraduationCapIcon />
          </EmptyMedia>
          <EmptyTitle>Este curso no está disponible</EmptyTitle>
          <EmptyDescription>
            Verificá que siga asignado a tu usuario para el ciclo {cicloLectivo}.
          </EmptyDescription>
        </Empty>
      </div>
    )
  }

  const asistenciaUrl = `/docente/asistencia/${divisionId}?fecha=${fecha}&nombre=${encodeURIComponent(
    curso?.etiqueta ?? '',
  )}`

  return (
    <div className="flex flex-col gap-5">
      <Link
        to={rutaVolver}
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-texto-2 hover:text-texto"
      >
        <ArrowLeftIcon className="size-4" /> {textoVolver}
      </Link>
      <PageHeader titulo={titulo} />
      <p className="-mt-4 text-sm text-texto-2">
        {curso
          ? `${curso.etiqueta} · ${curso.anio_numero}° año · ${curso.nivel_educativo_nombre} · Ciclo ${cicloLectivo}`
          : `Ciclo lectivo ${cicloLectivo}`}
      </p>

      {error && (
        <p role="alert" className="rounded-lg bg-error-suave p-3 text-sm text-error">
          {error}
        </p>
      )}
      {errorSeguimiento && (
        <p
          role="status"
          className="rounded-lg border border-borde bg-superficie p-3 text-sm text-texto-2"
        >
          {errorSeguimiento}
        </p>
      )}

      {vista === 'resumen' ? (
        <>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link
                to={asistenciaUrl}
                state={{ returnTo: `${location.pathname}${location.search}` }}
              >
                <CalendarIcon /> Tomar asistencia · {fechaFormateada}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to={`/docente/cursos/${divisionId}/alumnos`}>
                <UserRoundIcon /> Ver alumnos ({cargando ? '—' : alumnos.length})
              </Link>
            </Button>
            <Button asChild variant="link">
              <Link to={`/docente/cursos/${divisionId}/seguimiento`}>Ver seguimiento</Link>
            </Button>
          </div>

          <section aria-labelledby="resumen-curso-titulo">
            <h2 id="resumen-curso-titulo" className="mb-3 text-lg font-semibold text-texto">
              Resumen de asistencia · {cicloLectivo}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Card className="gap-2 p-4 shadow-card">
                <p className="text-sm text-texto-2">Alumnos activos</p>
                <p className="text-2xl font-semibold tabular-nums text-texto">
                  {cargando ? '—' : alumnos.length}
                </p>
                <p className="text-xs text-texto-2">Inscriptos vigentes en este ciclo</p>
              </Card>
              <Card className="gap-2 p-4 shadow-card">
                <p className="text-sm text-texto-2">Ausencias registradas</p>
                <p className="text-2xl font-semibold tabular-nums text-texto">
                  {cargandoSeguimiento || errorSeguimiento || seguimiento.length === 0
                    ? '—'
                    : totalAusenciasCurso}
                </p>
                <p className="text-xs text-texto-2">
                  {seguimiento.length === 0 && !cargandoSeguimiento && !errorSeguimiento
                    ? 'Sin registros de asistencia'
                    : 'Incluye ausencias justificadas'}
                </p>
              </Card>
              <Card className="gap-2 p-4 shadow-card">
                <p className="text-sm text-texto-2">Inasistencias reiteradas</p>
                <p className="text-2xl font-semibold tabular-nums text-texto">
                  {cargandoSeguimiento || errorSeguimiento || seguimiento.length === 0
                    ? '—'
                    : totalAlumnosConSeguimiento}
                </p>
                <p className="text-xs text-texto-2">20 acumuladas o 5 consecutivas</p>
              </Card>
            </div>
          </section>

          <section aria-labelledby="grafico-asistencia-titulo">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id="grafico-asistencia-titulo" className="text-lg font-semibold text-texto">
                Asistencia · últimos 30 días
              </h2>
              <div
                className="flex flex-wrap gap-3 text-xs text-texto-2"
                aria-label="Referencias del gráfico"
              >
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-exito" />
                  Presentes
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-error" />
                  Ausencias
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-advertencia" />
                  Tardanzas
                </span>
              </div>
            </div>
            <Card className="p-4 shadow-card">
              {cargandoAsistencias ? (
                <div
                  className="h-40 animate-pulse rounded-lg bg-fila-hover"
                  aria-label="Cargando gráfico de asistencia"
                />
              ) : errorAsistencias ? (
                <p role="status" className="text-sm text-texto-2">
                  {errorAsistencias}
                </p>
              ) : diasGrafico.length === 0 ? (
                <p className="py-8 text-center text-sm text-texto-2">
                  No hay asistencias registradas en los últimos 30 días.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <div
                    role="img"
                    aria-label={`Asistencia de los últimos 30 días: ${diasGrafico
                      .map(
                        (dia) =>
                          `${etiquetaFechaGrafico(dia.fecha)}: ${dia.presentes} presentes, ${dia.ausencias} ausencias, ${dia.tardanzas} tardanzas`,
                      )
                      .join('; ')}`}
                    className="flex h-48 min-w-[620px] items-end gap-2 border-b border-borde px-2"
                  >
                    {diasGrafico.map((dia) => {
                      const barras = [
                        { nombre: 'Presentes', valor: dia.presentes, clase: 'bg-exito' },
                        { nombre: 'Ausencias', valor: dia.ausencias, clase: 'bg-error' },
                        { nombre: 'Tardanzas', valor: dia.tardanzas, clase: 'bg-advertencia' },
                      ]
                      return (
                        <div
                          key={dia.fecha}
                          className="flex h-full min-w-4 flex-1 flex-col items-center justify-end gap-1"
                        >
                          <div className="flex h-36 w-full items-end justify-center gap-0.5">
                            {barras.map((barra) => (
                              <span
                                key={barra.nombre}
                                className={`w-1.5 rounded-t-sm ${barra.clase}`}
                                style={{
                                  height: barra.valor
                                    ? `${Math.max(4, (barra.valor / maximoGrafico) * 100)}%`
                                    : '0%',
                                }}
                                title={`${etiquetaFechaGrafico(dia.fecha)} · ${barra.nombre}: ${barra.valor}`}
                              />
                            ))}
                          </div>
                          <span className="whitespace-nowrap text-[10px] text-texto-2">
                            {etiquetaFechaGrafico(dia.fecha)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </Card>
          </section>
        </>
      ) : vista === 'alumnos' ? (
        <section aria-labelledby="alumnos-curso-titulo" className="min-w-0">
          <h2 id="alumnos-curso-titulo" className="sr-only">
            Alumnos activos del curso
          </h2>
          {cargando ? (
            <div className="h-36 animate-pulse rounded-panel bg-fila-hover" />
          ) : alumnos.length === 0 ? (
            <Empty className="min-h-[200px] rounded-panel bg-superficie shadow-card">
              <EmptyMedia variant="icon" className="bg-sup-academico text-info">
                <UserRoundIcon />
              </EmptyMedia>
              <EmptyTitle>No hay alumnos activos en este curso</EmptyTitle>
              <EmptyDescription>
                El listado corresponde al ciclo lectivo {cicloLectivo}.
              </EmptyDescription>
            </Empty>
          ) : (
            <div className="overflow-x-auto rounded-panel bg-superficie shadow-card">
              <Table className="min-w-[620px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Alumno</TableHead>
                    <TableHead>Legajo</TableHead>
                    <TableHead>Asistencia</TableHead>
                    <TableHead>Ausencias</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alumnos.map((alumno, index) => {
                    const indicador = seguimientoPorInscripcion.get(alumno.id)
                    return (
                      <TableRow key={alumno.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">
                          {alumno.alumno_apellido}, {alumno.alumno_nombre}
                        </TableCell>
                        <TableCell>{alumno.numero_legajo}</TableCell>
                        <TableCell>
                          {cargandoAsistencias
                            ? 'Consultando…'
                            : errorAsistencias
                              ? 'No disponible'
                              : asistenciaPorInscripcion.has(alumno.id)
                                ? `${asistenciaPorInscripcion.get(alumno.id)}%`
                                : 'Sin registros'}
                        </TableCell>
                        <TableCell>
                          {cargandoSeguimiento
                            ? 'Consultando…'
                            : errorSeguimiento
                              ? 'No disponible'
                              : indicador
                                ? `${indicador.total_ausencias} · ${indicador.ausencias_consecutivas} consecutivas`
                                : 'Sin registros'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="link" size="sm">
                            <Link
                              to={`/docente/cursos/${divisionId}/alumnos/${alumno.id}?ciclo_lectivo=${encodeURIComponent(cicloLectivo)}`}
                            >
                              Ficha académica
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      ) : (
        <section aria-labelledby="seguimiento-curso-titulo" className="min-w-0">
          <h2 id="seguimiento-curso-titulo" className="mb-3 text-lg font-semibold text-texto">
            Alumnos que alcanzan los umbrales de inasistencia reiterada
          </h2>
          {cargandoSeguimiento || cargando ? (
            <div className="h-36 animate-pulse rounded-panel bg-fila-hover" />
          ) : totalAlumnosConSeguimiento === 0 ? (
            <Empty className="min-h-[200px] rounded-panel bg-superficie shadow-card">
              <EmptyMedia variant="icon" className="bg-sup-academico text-info">
                <BookOpenCheckIcon />
              </EmptyMedia>
              <EmptyTitle>No hay inasistencias reiteradas para mostrar</EmptyTitle>
              <EmptyDescription>
                El seguimiento se calcula con registros reales: 20 ausencias acumuladas o 5
                consecutivas.
              </EmptyDescription>
            </Empty>
          ) : (
            <div className="overflow-x-auto rounded-panel bg-superficie shadow-card">
              <Table className="min-w-[620px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Alumno</TableHead>
                    <TableHead>Ausencias</TableHead>
                    <TableHead>Consecutivas</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alumnosConSeguimiento.map(({ alumno, indicador }, index) => (
                    <TableRow key={alumno.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        {alumno.alumno_apellido}, {alumno.alumno_nombre}
                      </TableCell>
                      <TableCell>{indicador?.total_ausencias ?? '—'}</TableCell>
                      <TableCell>{indicador?.ausencias_consecutivas ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="link" size="sm">
                          <Link
                            to={`/docente/cursos/${divisionId}/alumnos/${alumno.id}?ciclo_lectivo=${encodeURIComponent(cicloLectivo)}`}
                          >
                            Ver ficha
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
