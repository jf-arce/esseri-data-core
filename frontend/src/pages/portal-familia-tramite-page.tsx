import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  ConstructionIcon,
  DownloadIcon,
  XIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMisAlumnos } from '@/modules/familias-alumnos/hooks/use-mis-alumnos'
import {
  FormularioAusencia,
  type ModoFormularioAusencia,
} from '@/modules/academico/components/formulario-ausencia'
import { listarAsistenciasFamilia } from '@/modules/academico/services/listar-asistencias-familia'
import {
  cancelarSolicitudAusencia,
  descargarComprobanteSolicitudAusencia,
  listarSolicitudesAusenciaFamilia,
} from '@/modules/academico/services/solicitudes-ausencia-familia'
import { descargarComprobanteJustificacionFamilia } from '@/modules/academico/services/descargar-comprobante-justificacion-familia'
import type {
  AsistenciaFamilia,
  EstadoSolicitudPeriodo,
  SolicitudAusenciaPeriodo,
} from '@/modules/academico/types'
import { etiquetaMotivoJustificacion } from '@/modules/academico/utils'
const HISTORIAL_REGISTROS_POR_PAGINA = 5

function etiquetaAsistencia(asistencia: AsistenciaFamilia) {
  if (asistencia.justificacion_estado === 'pendiente') return 'En revisión'
  if (asistencia.justificacion_estado === 'aprobada') return 'Justificación aprobada'
  if (asistencia.justificacion_estado === 'rechazada') return 'Justificación rechazada'

  const etiquetas: Record<string, string> = {
    presente: 'Presente',
    tardanza: 'Tardanza',
    ausente_pendiente: 'Ausente pendiente',
    ausente_justificado: 'Ausente',
    ausente_injustificado: 'Ausente',
  }
  return etiquetas[asistencia.tipo] ?? asistencia.tipo.replaceAll('_', ' ')
}

function esPendiente(asistencia: AsistenciaFamilia) {
  return (
    asistencia.tipo === 'ausente_pendiente' &&
    (!asistencia.justificacion_estado || asistencia.justificacion_estado === 'pendiente')
  )
}

function iconoEstadoJustificacion(estado: AsistenciaFamilia['justificacion_estado']) {
  if (estado === 'aprobada') {
    return <CheckIcon className="size-4 shrink-0 text-exito" aria-label="Aprobada" />
  }
  if (estado === 'rechazada') {
    return <XIcon className="size-4 shrink-0 text-error" aria-label="Rechazada" />
  }
  if (estado === 'pendiente') {
    return (
      <ClockIcon
        className="size-4 shrink-0 text-advertencia"
        aria-label="Pendiente de aprobación"
      />
    )
  }
  return null
}

type PortalFamiliaTramitePageProps = {
  titulo: string
  descripcion: string
  seccionInicial?: SeccionAsistencia
  modo?: ModoFormularioAusencia | 'asistencias'
  abrirFormularioInicial?: boolean
}

type SeccionAsistencia = 'resumen' | 'pendientes' | 'historial' | 'solicitudes'

function etiquetaEstadoSolicitud(estado: EstadoSolicitudPeriodo): string {
  const etiquetas: Record<EstadoSolicitudPeriodo, string> = {
    pendiente: 'Pendiente',
    aprobada: 'Aprobada',
    rechazada: 'Rechazada',
    cancelada: 'Cancelada',
    revocada: 'Revocada',
  }
  return etiquetas[estado]
}

function formatearFecha(fecha: string): string {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR')
}

type FiltroHistorial = 'todas' | 'inasistencias' | 'asistencias' | 'tardanzas'
type OrdenHistorial = 'fecha-desc' | 'fecha-asc'

type ResumenAsistencias = {
  presentes: number
  inasistencias: number
  tardanzas: number
  justificadas: number
}

function resumirAsistencias(asistencias: AsistenciaFamilia[]): ResumenAsistencias {
  return asistencias.reduce<ResumenAsistencias>(
    (resumen, asistencia) => {
      if (asistencia.tipo === 'presente') resumen.presentes += 1
      else if (asistencia.tipo === 'tardanza') resumen.tardanzas += 1
      else {
        resumen.inasistencias += 1
        if (
          asistencia.tipo === 'ausente_justificado' ||
          asistencia.justificacion_estado === 'aprobada'
        ) {
          resumen.justificadas += 1
        }
      }
      return resumen
    },
    { presentes: 0, inasistencias: 0, tardanzas: 0, justificadas: 0 },
  )
}

function coincideConFiltroHistorial(asistencia: AsistenciaFamilia, filtro: FiltroHistorial) {
  if (filtro === 'todas') return true
  if (filtro === 'asistencias') return asistencia.tipo === 'presente'
  if (filtro === 'tardanzas') return asistencia.tipo === 'tardanza'
  return asistencia.tipo.startsWith('ausente_')
}

// Estos trámites tienen una pantalla propia para completar el flujo del portal sin reutilizar
// vistas de backoffice. Su operación se habilitará cuando existan endpoints que autoricen a la
// familia sólo sobre sus alumnos vinculados.
export function PortalFamiliaTramitePage({
  titulo,
  descripcion,
  seccionInicial,
  modo,
  abrirFormularioInicial = false,
}: PortalFamiliaTramitePageProps) {
  const modoEfectivo = modo ?? (titulo === 'Asistencias' ? 'asistencias' : 'justificar')
  const esAsistencias = modoEfectivo === 'asistencias'
  const esJustificacion = true
  const { alumnos } = useMisAlumnos(esJustificacion)
  const [asistencias, setAsistencias] = useState<AsistenciaFamilia[]>([])
  const [solicitudes, setSolicitudes] = useState<SolicitudAusenciaPeriodo[]>([])
  const [alumnoId, setAlumnoId] = useState('')
  const [formularioAbierto, setFormularioAbierto] = useState(
    modoEfectivo === 'informar' || abrirFormularioInicial,
  )
  const [formularioModo, setFormularioModo] = useState<ModoFormularioAusencia>(
    modoEfectivo === 'informar' ? 'informar' : 'justificar',
  )
  const [fechaInicial, setFechaInicial] = useState<string | undefined>()
  const [revision, setRevision] = useState(0)
  const [detalleExpandido, setDetalleExpandido] = useState<string | null>(null)
  const [historialFechaDesde, setHistorialFechaDesde] = useState('')
  const [historialFechaHasta, setHistorialFechaHasta] = useState('')
  const [historialFiltro, setHistorialFiltro] = useState<FiltroHistorial>('todas')
  const [historialOrden, setHistorialOrden] = useState<OrdenHistorial>('fecha-desc')
  const [historialPagina, setHistorialPagina] = useState(1)
  const [seccionAsistencia, setSeccionAsistencia] = useState<SeccionAsistencia>(
    seccionInicial ?? (esAsistencias ? 'resumen' : 'pendientes'),
  )
  const alumnoSeleccionado = alumnoId || alumnos[0]?.alumno_id || ''
  const solicitudesActivas = useMemo(
    () =>
      solicitudes.filter(
        (solicitud) => solicitud.estado === 'pendiente' || solicitud.estado === 'aprobada',
      ),
    [solicitudes],
  )
  function cubiertaPorPeriodo(fecha: string) {
    return solicitudesActivas.some(
      (solicitud) => solicitud.fecha_inicio <= fecha && solicitud.fecha_fin >= fecha,
    )
  }
  const asistenciasPendientes = asistencias.filter(esPendiente)
  const asistenciasHistorial = asistencias.filter((asistencia) => !esPendiente(asistencia))
  const resumenAsistencias = resumirAsistencias(asistencias)
  const asistenciasHistorialFiltradas = useMemo(() => {
    const filtradas = asistenciasHistorial.filter((asistencia) => {
      if (historialFechaDesde && asistencia.fecha < historialFechaDesde) return false
      if (historialFechaHasta && asistencia.fecha > historialFechaHasta) return false
      return coincideConFiltroHistorial(asistencia, historialFiltro)
    })

    return filtradas.toSorted((a, b) => {
      const comparacion = a.fecha.localeCompare(b.fecha)
      return historialOrden === 'fecha-desc' ? -comparacion : comparacion
    })
  }, [
    asistenciasHistorial,
    historialFechaDesde,
    historialFechaHasta,
    historialFiltro,
    historialOrden,
  ])
  const historialTotalPaginas = Math.max(
    1,
    Math.ceil(asistenciasHistorialFiltradas.length / HISTORIAL_REGISTROS_POR_PAGINA),
  )
  const historialPaginaActual = Math.min(historialPagina, historialTotalPaginas)
  const asistenciasHistorialPaginadas = useMemo(() => {
    const inicio = (historialPaginaActual - 1) * HISTORIAL_REGISTROS_POR_PAGINA
    return asistenciasHistorialFiltradas.slice(inicio, inicio + HISTORIAL_REGISTROS_POR_PAGINA)
  }, [asistenciasHistorialFiltradas, historialPaginaActual])
  const opcionesSeccion: Array<{ clave: SeccionAsistencia; etiqueta: string }> = esAsistencias
    ? [
        { clave: 'resumen', etiqueta: 'Resumen' },
        { clave: 'pendientes', etiqueta: 'Justificar asistencia' },
        { clave: 'historial', etiqueta: 'Historial' },
        { clave: 'solicitudes', etiqueta: 'Solicitudes' },
      ]
    : [
        { clave: 'pendientes', etiqueta: 'Pendientes' },
        { clave: 'historial', etiqueta: 'Historial' },
        { clave: 'solicitudes', etiqueta: 'Solicitudes' },
      ]
  useEffect(() => {
    if (!alumnoSeleccionado) return
    let activo = true
    void Promise.all([
      listarAsistenciasFamilia(alumnoSeleccionado).catch(() => [] as AsistenciaFamilia[]),
      listarSolicitudesAusenciaFamilia(alumnoSeleccionado).catch(
        () => [] as SolicitudAusenciaPeriodo[],
      ),
    ]).then(([asistenciasCargadas, solicitudesCargadas]) => {
      if (!activo) return
      setAsistencias(asistenciasCargadas)
      setSolicitudes(solicitudesCargadas)
    })
    return () => {
      activo = false
    }
  }, [alumnoSeleccionado, revision])
  async function cancelarSolicitud(solicitud: SolicitudAusenciaPeriodo) {
    if (!window.confirm('¿Cancelar esta solicitud de ausencia?')) return
    try {
      await cancelarSolicitudAusencia(solicitud.id)
      toast.success('Solicitud cancelada.')
      setRevision((valor) => valor + 1)
    } catch {
      toast.error('No se pudo cancelar la solicitud.')
    }
  }
  function abrirFormulario(nuevoModo: ModoFormularioAusencia, fecha?: string) {
    setFormularioModo(nuevoModo)
    setFechaInicial(fecha)
    setFormularioAbierto(true)
  }
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link
        to="/familia"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-texto-2 hover:text-violeta"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        Volver al inicio
      </Link>
      <header>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[.06em] text-texto-3 uppercase">
              Portal de familia
            </p>
            <h1 className="mt-1 font-heading text-2xl font-semibold text-texto">{titulo}</h1>
          </div>
          {esJustificacion && alumnos.length > 0 && (
            <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
              <label className="w-full text-sm font-semibold sm:w-56">
                Alumno
                <select
                  className="mt-1 block w-full rounded-lg border border-borde bg-superficie p-2"
                  value={alumnoSeleccionado}
                  onChange={(e) => setAlumnoId(e.target.value)}
                >
                  {alumnos.map((alumno) => (
                    <option key={alumno.alumno_id} value={alumno.alumno_id}>
                      {alumno.nombre} {alumno.apellido}
                    </option>
                  ))}
                </select>
              </label>
              <Button variant="secondary" onClick={() => abrirFormulario('informar')}>
                Informar ausencia
              </Button>
            </div>
          )}
        </div>
      </header>
      <Card>
        {!esAsistencias && (
          <CardHeader>
            <CardTitle>{titulo}</CardTitle>
            <CardDescription>{descripcion}</CardDescription>
          </CardHeader>
        )}
        <CardContent>
          {esJustificacion && alumnos.length > 0 ? (
            <div className="flex flex-col gap-4">
              <div
                role="tablist"
                aria-label="Sección de asistencias"
                className={`grid gap-1 rounded-lg bg-fila-hover p-1 ${
                  opcionesSeccion.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'
                }`}
              >
                {opcionesSeccion.map(({ clave, etiqueta }) => {
                  const seleccionada = seccionAsistencia === clave
                  return (
                    <button
                      key={clave}
                      id={`asistencias-tab-${clave}`}
                      type="button"
                      role="tab"
                      aria-selected={seleccionada}
                      aria-controls={`asistencias-panel-${clave}`}
                      className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta ${seleccionada ? 'bg-superficie text-violeta shadow-sm' : 'text-texto-2 hover:text-texto'}`}
                      onClick={() => setSeccionAsistencia(clave)}
                    >
                      {etiqueta}
                    </button>
                  )
                })}
              </div>
              {seccionAsistencia === 'resumen' ? (
                <section
                  id="asistencias-panel-resumen"
                  role="tabpanel"
                  aria-labelledby="asistencias-tab-resumen"
                  tabIndex={0}
                >
                  <h2 className="mb-2 text-sm font-semibold text-texto">Resumen de asistencia</h2>
                  {asistencias.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <article className="rounded-card border border-borde bg-superficie p-4 shadow-card transition-shadow hover:shadow-overlay">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex size-9 items-center justify-center rounded-lg bg-exito-suave text-exito">
                            <CheckIcon className="size-5" aria-hidden="true" />
                          </span>
                          <span className="text-sm font-semibold text-texto-2">Asistencias</span>
                        </div>
                        <p className="mt-3 text-3xl font-semibold tabular-nums text-texto">
                          {resumenAsistencias.presentes}
                        </p>
                        <p className="mt-1 text-xs text-texto-3">Días presentes</p>
                      </article>
                      <article className="rounded-card border border-borde bg-superficie p-4 shadow-card transition-shadow hover:shadow-overlay">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex size-9 items-center justify-center rounded-lg bg-error-suave text-error">
                            <XIcon className="size-5" aria-hidden="true" />
                          </span>
                          <span className="text-sm font-semibold text-texto-2">Inasistencias</span>
                        </div>
                        <p className="mt-3 text-3xl font-semibold tabular-nums text-texto">
                          {resumenAsistencias.inasistencias}
                        </p>
                        <p className="mt-1 text-xs font-medium text-error">
                          {resumenAsistencias.justificadas}{' '}
                          {resumenAsistencias.justificadas === 1 ? 'justificada' : 'justificadas'}
                        </p>
                      </article>
                      <article className="rounded-card border border-borde bg-superficie p-4 shadow-card transition-shadow hover:shadow-overlay">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex size-9 items-center justify-center rounded-lg bg-advertencia-suave text-advertencia">
                            <ClockIcon className="size-5" aria-hidden="true" />
                          </span>
                          <span className="text-sm font-semibold text-texto-2">Tardanzas</span>
                        </div>
                        <p className="mt-3 text-3xl font-semibold tabular-nums text-texto">
                          {resumenAsistencias.tardanzas}
                        </p>
                        <p className="mt-1 text-xs text-texto-3">Llegadas fuera de horario</p>
                      </article>
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-borde p-4 text-sm text-texto-2">
                      Todavía no hay registros de asistencia para este alumno.
                    </p>
                  )}
                </section>
              ) : seccionAsistencia === 'pendientes' ? (
                <section
                  id="asistencias-panel-pendientes"
                  role="tabpanel"
                  aria-labelledby="asistencias-tab-pendientes"
                  tabIndex={0}
                >
                  <h2 className="mb-2 text-sm font-semibold text-texto">
                    {esAsistencias ? 'Justificar asistencia' : 'Pendientes'}
                  </h2>
                  {asistenciasPendientes.length > 0 ? (
                    <div className="divide-y divide-borde rounded-lg border border-borde">
                      {asistenciasPendientes.map((asistencia) => (
                        <div
                          key={asistencia.id}
                          className="p-3 text-sm first:rounded-t-lg last:rounded-b-lg"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex-1">
                              {new Date(`${asistencia.fecha}T00:00:00`).toLocaleDateString('es-AR')}
                            </span>
                            <span className="text-texto-2">{etiquetaAsistencia(asistencia)}</span>
                            {iconoEstadoJustificacion(asistencia.justificacion_estado)}
                            {!asistencia.justificacion_estado &&
                              (cubiertaPorPeriodo(asistencia.fecha) ? (
                                <span className="text-xs text-texto-3">Cubierta por solicitud</span>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => abrirFormulario('justificar', asistencia.fecha)}
                                >
                                  Justificar
                                </Button>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-borde p-4 text-sm text-texto-2">
                      No tenés ausencias pendientes de justificar.
                    </p>
                  )}
                </section>
              ) : seccionAsistencia === 'solicitudes' ? (
                <section
                  id="asistencias-panel-solicitudes"
                  role="tabpanel"
                  aria-labelledby="asistencias-tab-solicitudes"
                  tabIndex={0}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-texto">Solicitudes de ausencia</h2>
                    <Button size="sm" onClick={() => abrirFormulario('informar')}>
                      Informar ausencia
                    </Button>
                  </div>
                  {solicitudes.length > 0 ? (
                    <div className="divide-y divide-borde rounded-lg border border-borde">
                      {solicitudes.map((solicitud) => (
                        <div
                          key={solicitud.id}
                          className="p-3 text-sm first:rounded-t-lg last:rounded-b-lg"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="flex-1">
                              {formatearFecha(solicitud.fecha_inicio)}
                              {solicitud.fecha_fin !== solicitud.fecha_inicio
                                ? ` — ${formatearFecha(solicitud.fecha_fin)}`
                                : ''}
                            </span>
                            <span className="rounded-full border border-borde px-2 py-0.5 text-xs font-semibold text-texto-2">
                              {etiquetaEstadoSolicitud(solicitud.estado)}
                            </span>
                            {solicitud.estado === 'pendiente' && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => void cancelarSolicitud(solicitud)}
                              >
                                Cancelar
                              </Button>
                            )}
                          </div>
                          <p className="mt-1 text-texto-2">
                            Motivo: {etiquetaMotivoJustificacion(solicitud.motivo)}
                          </p>
                          {solicitud.observacion && (
                            <p className="text-texto-2">Observación: {solicitud.observacion}</p>
                          )}
                          {solicitud.observacion_resolucion && (
                            <p className="text-texto-2">
                              Resolución: {solicitud.observacion_resolucion}
                            </p>
                          )}
                          {solicitud.archivo_nombre && (
                            <Button
                              variant="link"
                              className="mt-1 h-auto p-0 text-sm"
                              onClick={() =>
                                void descargarComprobanteSolicitudAusencia(
                                  solicitud.id,
                                  solicitud.archivo_nombre ?? 'comprobante',
                                )
                              }
                            >
                              <DownloadIcon data-icon="inline-start" />
                              {solicitud.archivo_nombre}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-borde p-4 text-sm text-texto-2">
                      Todavía no informaste ausencias por período.
                    </p>
                  )}
                </section>
              ) : (
                <section
                  id="asistencias-panel-historial"
                  role="tabpanel"
                  aria-labelledby="asistencias-tab-historial"
                  tabIndex={0}
                >
                  <h2 className="mb-2 text-sm font-semibold text-texto">Historial</h2>
                  {asistenciasHistorial.length > 0 ? (
                    <>
                      <div className="mb-4 grid gap-3 rounded-card border border-borde bg-fila-hover/40 p-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Field>
                          <FieldLabel htmlFor="historial-fecha-desde">Desde</FieldLabel>
                          <Input
                            id="historial-fecha-desde"
                            type="date"
                            value={historialFechaDesde}
                            max={historialFechaHasta || undefined}
                            onChange={(evento) => {
                              setHistorialPagina(1)
                              setHistorialFechaDesde(evento.target.value)
                            }}
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="historial-fecha-hasta">Hasta</FieldLabel>
                          <Input
                            id="historial-fecha-hasta"
                            type="date"
                            value={historialFechaHasta}
                            min={historialFechaDesde || undefined}
                            onChange={(evento) => {
                              setHistorialPagina(1)
                              setHistorialFechaHasta(evento.target.value)
                            }}
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="historial-tipo">Tipo</FieldLabel>
                          <Select
                            value={historialFiltro}
                            onValueChange={(valor) => {
                              setHistorialPagina(1)
                              setHistorialFiltro(valor as FiltroHistorial)
                            }}
                          >
                            <SelectTrigger id="historial-tipo" className="w-full">
                              <SelectValue placeholder="Todas" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todas">Todas</SelectItem>
                              <SelectItem value="inasistencias">Inasistencias</SelectItem>
                              <SelectItem value="asistencias">Asistencias</SelectItem>
                              <SelectItem value="tardanzas">Tardanzas</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="historial-orden">Ordenar por fecha</FieldLabel>
                          <Select
                            value={historialOrden}
                            onValueChange={(valor) => {
                              setHistorialPagina(1)
                              setHistorialOrden(valor as OrdenHistorial)
                            }}
                          >
                            <SelectTrigger id="historial-orden" className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fecha-asc">Ascendente</SelectItem>
                              <SelectItem value="fecha-desc">Descendente</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>
                      {asistenciasHistorialFiltradas.length > 0 ? (
                        <>
                          <div className="divide-y divide-borde rounded-lg border border-borde">
                            {asistenciasHistorialPaginadas.map((asistencia) => {
                              const detalleId = `justificacion-detalle-${asistencia.id}`
                              const expandido = detalleExpandido === asistencia.id
                              return (
                                <div
                                  key={asistencia.id}
                                  className="px-3 py-2 text-sm first:rounded-t-lg last:rounded-b-lg"
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="flex-1">
                                      {new Date(`${asistencia.fecha}T00:00:00`).toLocaleDateString(
                                        'es-AR',
                                      )}
                                    </span>
                                    <span className="text-right text-texto-2">
                                      {etiquetaAsistencia(asistencia)}
                                    </span>
                                    {iconoEstadoJustificacion(asistencia.justificacion_estado)}
                                    {asistencia.justificacion_id && (
                                      <button
                                        type="button"
                                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-texto-2 transition-colors hover:bg-fila-hover hover:text-violeta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta"
                                        aria-label={`${expandido ? 'Ocultar' : 'Mostrar'} detalle de la justificación del ${new Date(`${asistencia.fecha}T00:00:00`).toLocaleDateString('es-AR')}`}
                                        aria-expanded={expandido}
                                        aria-controls={detalleId}
                                        onClick={() =>
                                          setDetalleExpandido(expandido ? null : asistencia.id)
                                        }
                                      >
                                        <ChevronDownIcon
                                          aria-hidden="true"
                                          className={`size-4 transition-transform ${expandido ? 'rotate-180' : ''}`}
                                        />
                                      </button>
                                    )}
                                  </div>
                                  {asistencia.justificacion_id && (
                                    <div
                                      id={detalleId}
                                      hidden={!expandido}
                                      className="mt-2 rounded-lg bg-fila-hover p-2.5 text-xs text-texto-2"
                                    >
                                      <p>
                                        <strong>Motivo:</strong>{' '}
                                        {etiquetaMotivoJustificacion(
                                          asistencia.justificacion_motivo,
                                        )}
                                      </p>
                                      {asistencia.justificacion_observacion && (
                                        <p className="mt-1">
                                          <strong>Observación:</strong>{' '}
                                          {asistencia.justificacion_observacion}
                                        </p>
                                      )}
                                      {asistencia.justificacion_archivo_nombre && (
                                        <button
                                          type="button"
                                          className="mt-2 inline-flex items-center gap-1 font-semibold text-violeta hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta"
                                          onClick={() =>
                                            void descargarComprobanteJustificacionFamilia(
                                              asistencia.justificacion_id!,
                                              asistencia.justificacion_archivo_nombre!,
                                            )
                                          }
                                        >
                                          <DownloadIcon className="size-3.5" aria-hidden="true" />
                                          {asistencia.justificacion_archivo_nombre}
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                          {historialTotalPaginas > 1 && (
                            <nav
                              className="mt-3 flex items-center justify-between gap-3 text-xs text-texto-2"
                              aria-label="Paginación del historial"
                            >
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={historialPaginaActual === 1}
                                onClick={() =>
                                  setHistorialPagina((pagina) => Math.max(1, pagina - 1))
                                }
                              >
                                <ChevronLeftIcon aria-hidden="true" />
                                Anterior
                              </Button>
                              <span aria-live="polite">
                                Página {historialPaginaActual} de {historialTotalPaginas}
                              </span>
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={historialPaginaActual === historialTotalPaginas}
                                onClick={() =>
                                  setHistorialPagina((pagina) =>
                                    Math.min(historialTotalPaginas, pagina + 1),
                                  )
                                }
                              >
                                Siguiente
                                <ChevronRightIcon aria-hidden="true" />
                              </Button>
                            </nav>
                          )}
                        </>
                      ) : (
                        <p className="rounded-lg border border-dashed border-borde p-4 text-sm text-texto-2">
                          No hay registros que coincidan con los filtros seleccionados.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="rounded-lg border border-dashed border-borde p-4 text-sm text-texto-2">
                      Todavía no hay registros en tu historial.
                    </p>
                  )}
                </section>
              )}
            </div>
          ) : (
            <Empty className="min-h-64">
              <EmptyMedia variant="neutral">
                <ConstructionIcon />
              </EmptyMedia>
              <EmptyTitle>Este trámite estará disponible pronto</EmptyTitle>
              <EmptyDescription>
                Estamos preparando el acceso seguro para que puedas gestionar información de tus
                alumnos desde este portal.
              </EmptyDescription>
            </Empty>
          )}
        </CardContent>
      </Card>
      <FormularioAusencia
        key={`${formularioModo}-${fechaInicial ?? 'sin-fecha'}-${formularioAbierto ? 'abierto' : 'cerrado'}`}
        abierto={formularioAbierto}
        modo={formularioModo}
        alumnoId={alumnoSeleccionado}
        fechaInicial={fechaInicial}
        onOpenChange={setFormularioAbierto}
        onEnviado={() => setRevision((valor) => valor + 1)}
      />
    </section>
  )
}
