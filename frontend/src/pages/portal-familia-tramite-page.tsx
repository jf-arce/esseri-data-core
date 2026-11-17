import {
  BarChart3Icon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CirclePlusIcon,
  ClockIcon,
  ConstructionIcon,
  DownloadIcon,
  FileTextIcon,
  HistoryIcon,
  InboxIcon,
  ListIcon,
  MoreHorizontalIcon,
  PaperclipIcon,
  SearchIcon,
  StickyNoteIcon,
  UserRoundIcon,
  XIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PortalFamiliaShell } from '@/components/portal-familia/portal-familia-shell'
import { PortalFamiliaWatermark } from '@/components/portal-familia/portal-familia-watermark'
import {
  PORTAL_PRIMARY_BUTTON_CLASS,
  PortalAlertBanner,
  PortalCard,
  PortalStatTile,
} from '@/components/portal-familia/portal-familia-ui'
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
import { esAusenciaSinJustificar } from '@/modules/academico/utils'
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
import {
  etiquetaMotivoJustificacion,
  VARIANTE_ESTADO_SOLICITUD_PERIODO,
} from '@/modules/academico/utils'
const HISTORIAL_REGISTROS_POR_PAGINA = 5
const ULTIMOS_REGISTROS_VISIBLES = 5
const NOMBRES_MES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

/** "2026-11-12" → "Noviembre 2026". */
function etiquetaPeriodo(periodo: string): string {
  if (!periodo.includes('-')) return `Todo ${periodo}`
  const [anio, mes] = periodo.split('-')
  const nombre = NOMBRES_MES[Number(mes) - 1]
  return nombre ? `${nombre} ${anio}` : periodo
}

function periodoDisponible(periodo: string, disponibles: string[]): boolean {
  return periodo.length === 4
    ? disponibles.some((clave) => clave.startsWith(periodo))
    : disponibles.includes(periodo)
}

function fechaCorta(fecha: string): string {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

type SelectorPeriodoProps = {
  valor: string
  periodos: string[]
  onChange: (periodo: string) => void
  etiqueta: string
}

/** Selector de mes y año acotado a los períodos con registros. */
function SelectorPeriodo({ valor, periodos, onChange, etiqueta }: SelectorPeriodoProps) {
  const anioDelValor = Number(valor.split('-')[0]) || new Date().getFullYear()
  const [anioNavegado, setAnioNavegado] = useState<number | null>(null)
  const anio = anioNavegado ?? anioDelValor

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${etiqueta}: ${etiquetaPeriodo(valor)}`}
          className="inline-flex min-h-10 items-center gap-2 rounded-[12px] border border-[#E7DDF1] bg-white px-3 text-[14px] font-medium text-[#2B2338] transition-colors hover:bg-[#FBF9FE]"
        >
          <CalendarDaysIcon aria-hidden="true" className="size-4 text-[#7A2FA8]" />
          {etiquetaPeriodo(valor)}
          <ChevronDownIcon aria-hidden="true" className="size-4 text-[#6B6478]" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="portal-familia w-72">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Año anterior"
            className="inline-flex size-8 items-center justify-center rounded-full text-[#6B6478] hover:bg-[#F5EFFA] hover:text-[#7A2FA8]"
            onClick={() => setAnioNavegado(anio - 1)}
          >
            <ChevronLeftIcon aria-hidden="true" className="size-4" />
          </button>
          <span className="text-[15px] font-semibold text-[#2B2338] tabular-nums">{anio}</span>
          <button
            type="button"
            aria-label="Año siguiente"
            className="inline-flex size-8 items-center justify-center rounded-full text-[#6B6478] hover:bg-[#F5EFFA] hover:text-[#7A2FA8]"
            onClick={() => setAnioNavegado(anio + 1)}
          >
            <ChevronRightIcon aria-hidden="true" className="size-4" />
          </button>
        </div>
        <button
          type="button"
          disabled={!periodos.some((periodo) => periodo.startsWith(String(anio)))}
          aria-pressed={valor === String(anio)}
          onClick={() => {
            setAnioNavegado(null)
            onChange(String(anio))
          }}
          className={`min-h-9 w-full rounded-[10px] text-[14px] font-medium transition-colors ${
            valor === String(anio)
              ? 'bg-[#7A2FA8] text-white'
              : periodos.some((periodo) => periodo.startsWith(String(anio)))
                ? 'text-[#2B2338] hover:bg-[#F5EFFA]'
                : 'cursor-not-allowed text-[#C9C2D3]'
          }`}
        >
          Todo el año
        </button>
        <div className="grid grid-cols-3 gap-1">
          {NOMBRES_MES.map((nombre, indice) => {
            const clave = `${anio}-${String(indice + 1).padStart(2, '0')}`
            const disponible = periodos.includes(clave)
            const activo = clave === valor
            return (
              <button
                key={clave}
                type="button"
                disabled={!disponible}
                aria-pressed={activo}
                onClick={() => {
                  setAnioNavegado(null)
                  onChange(clave)
                }}
                className={`min-h-9 rounded-[10px] text-[14px] font-medium transition-colors ${
                  activo
                    ? 'bg-[#7A2FA8] text-white'
                    : disponible
                      ? 'text-[#2B2338] hover:bg-[#F5EFFA]'
                      : 'cursor-not-allowed text-[#C9C2D3]'
                }`}
              >
                {nombre.slice(0, 3)}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

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

type DetalleJustificacion =
  | { tipo: 'pendiente'; asistencia: AsistenciaFamilia }
  | { tipo: 'enviada'; solicitud: SolicitudAusenciaPeriodo }

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

function formatearFechaHora(valor: string | null): string {
  if (!valor) return '—'
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return '—'
  return fecha.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function rangoPeriodo(solicitud: SolicitudAusenciaPeriodo): string {
  return solicitud.fecha_inicio === solicitud.fecha_fin
    ? formatearFecha(solicitud.fecha_inicio)
    : `${formatearFecha(solicitud.fecha_inicio)} – ${formatearFecha(solicitud.fecha_fin)}`
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

function condicionAsistencia(asistencia: AsistenciaFamilia): {
  etiqueta: string
  variante: 'exito' | 'advertencia' | 'error'
} {
  if (asistencia.tipo === 'presente') return { etiqueta: 'Presente', variante: 'exito' }
  if (asistencia.tipo === 'tardanza') return { etiqueta: 'Tardanza', variante: 'advertencia' }
  return { etiqueta: 'Ausente', variante: 'error' }
}

function justificacionVisible(asistencia: AsistenciaFamilia): string {
  if (asistencia.justificacion_estado === 'aprobada') return 'Justificada'
  if (asistencia.justificacion_estado === 'pendiente') return 'En revisión'
  if (asistencia.justificacion_estado === 'rechazada') return 'Rechazada'
  if (asistencia.tipo === 'ausente_injustificado') return 'Sin justificar'
  return '—'
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
  const alumnoActual = alumnos.find((alumno) => alumno.alumno_id === alumnoSeleccionado)
  const nombreAlumno = alumnoActual
    ? `${alumnoActual.nombre} ${alumnoActual.apellido}`
    : 'Alumno sin identificar'
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
  const asistenciasPendientes = useMemo(
    () =>
      asistencias.filter(
        (asistencia) =>
          esAusenciaSinJustificar(asistencia) &&
          !solicitudesActivas.some(
            (solicitud) =>
              solicitud.fecha_inicio <= asistencia.fecha && solicitud.fecha_fin >= asistencia.fecha,
          ),
      ),
    [asistencias, solicitudesActivas],
  )
  const asistenciasHistorial = useMemo(
    () => asistencias.filter((asistencia) => !asistenciasPendientes.includes(asistencia)),
    [asistencias, asistenciasPendientes],
  )
  const periodos = useMemo(() => {
    const unicos = new Set(asistencias.map((asistencia) => asistencia.fecha.slice(0, 7)))
    return [...unicos].sort((a, b) => b.localeCompare(a))
  }, [asistencias])
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('')
  const periodoActivo = periodoDisponible(periodoSeleccionado, periodos)
    ? periodoSeleccionado
    : (periodos[0] ?? '')
  const resumenPeriodo = useMemo(
    () =>
      resumirAsistencias(
        asistencias.filter(
          (asistencia) => !periodoActivo || asistencia.fecha.startsWith(periodoActivo),
        ),
      ),
    [asistencias, periodoActivo],
  )
  const totalPeriodo =
    resumenPeriodo.presentes + resumenPeriodo.inasistencias + resumenPeriodo.tardanzas
  const porcentajeAsistencia =
    totalPeriodo === 0 ? 0 : Math.round((resumenPeriodo.presentes / totalPeriodo) * 1000) / 10
  const ultimosRegistros = useMemo(
    () =>
      [...asistencias]
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .slice(0, ULTIMOS_REGISTROS_VISIBLES),
    [asistencias],
  )
  const [filtroJustificacion, setFiltroJustificacion] = useState<
    'todas' | 'pendientes' | 'enviadas'
  >('todas')
  const [busquedaJustificacion, setBusquedaJustificacion] = useState('')
  const [periodoJustificacion, setPeriodoJustificacion] = useState('')
  const [detalleJustificacion, setDetalleJustificacion] = useState<DetalleJustificacion | null>(
    null,
  )
  const periodosJustificacion = useMemo(() => {
    const unicos = new Set<string>([
      ...asistenciasPendientes.map((asistencia) => asistencia.fecha.slice(0, 7)),
      ...solicitudes.map((solicitud) => solicitud.fecha_inicio.slice(0, 7)),
    ])
    return [...unicos].sort((a, b) => b.localeCompare(a))
  }, [asistenciasPendientes, solicitudes])
  const periodoJustificacionActivo = periodoDisponible(periodoJustificacion, periodosJustificacion)
    ? periodoJustificacion
    : (periodosJustificacion[0] ?? '')
  const pendientesJustificacion = useMemo(
    () =>
      asistenciasPendientes.filter(
        (asistencia) =>
          !periodoJustificacionActivo || asistencia.fecha.startsWith(periodoJustificacionActivo),
      ),
    [asistenciasPendientes, periodoJustificacionActivo],
  )
  const enviadasJustificacion = useMemo(() => {
    const termino = busquedaJustificacion.trim().toLowerCase()
    return solicitudes.filter((solicitud) => {
      if (
        periodoJustificacionActivo &&
        !solicitud.fecha_inicio.startsWith(periodoJustificacionActivo)
      ) {
        return false
      }
      if (!termino) return true
      return `${solicitud.motivo} ${etiquetaMotivoJustificacion(solicitud.motivo)} ${solicitud.observacion ?? ''}`
        .toLowerCase()
        .includes(termino)
    })
  }, [solicitudes, periodoJustificacionActivo, busquedaJustificacion])
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
        { clave: 'pendientes', etiqueta: 'Justificaciones' },
        { clave: 'historial', etiqueta: 'Historial' },
      ]
    : [
        { clave: 'pendientes', etiqueta: 'Pendientes' },
        { clave: 'historial', etiqueta: 'Historial' },
      ]
  const iconoSeccion: Record<SeccionAsistencia, LucideIcon> = {
    resumen: BarChart3Icon,
    pendientes: FileTextIcon,
    historial: HistoryIcon,
    solicitudes: InboxIcon,
  }
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
    <section className="relative isolate flex w-full flex-col">
      <PortalFamiliaWatermark />
      <PortalFamiliaShell
        titulo={titulo}
        descripcion={descripcion}
        etiqueta="Portal de familia"
        volverA="/familia"
        volverEtiqueta="Volver al inicio"
        anchoMaximo="max-w-[92vw]"
        acciones={
          esJustificacion && alumnos.length > 0 ? (
            <div className="w-full sm:w-64">
              <Field>
                <FieldLabel htmlFor="familia-alumno" className="text-texto-2">
                  Alumno
                </FieldLabel>
                <Select value={alumnoSeleccionado} onValueChange={setAlumnoId}>
                  <SelectTrigger id="familia-alumno" className="w-full">
                    <span className="flex items-center gap-2">
                      <UserRoundIcon aria-hidden="true" className="size-4 text-[#6B6478]" />
                      <SelectValue placeholder="Seleccioná un alumno" />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {alumnos.map((alumno) => (
                      <SelectItem key={alumno.alumno_id} value={alumno.alumno_id}>
                        {alumno.nombre} {alumno.apellido}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          ) : undefined
        }
      />

      <div className="mx-auto flex w-full max-w-[92vw] flex-col gap-5 pt-2">
        <PortalCard contentClassName="px-5 pt-4 pb-5 sm:px-6 sm:pt-5 sm:pb-6">
          {esJustificacion && alumnos.length > 0 ? (
            <div className="flex flex-col gap-4">
              {esAsistencias && asistenciasPendientes.length > 0 && (
                <PortalAlertBanner
                  titulo={
                    seccionAsistencia === 'pendientes'
                      ? asistenciasPendientes.length === 1
                        ? 'Tenés una ausencia pendiente de justificar'
                        : `Tenés ${asistenciasPendientes.length} ausencias pendientes de justificar`
                      : asistenciasPendientes.length === 1
                        ? 'Tenés una ausencia pendiente'
                        : `Tenés ${asistenciasPendientes.length} ausencias pendientes`
                  }
                  descripcion={
                    seccionAsistencia === 'pendientes'
                      ? asistenciasPendientes.length === 1
                        ? 'Podés justificarla desde esta sección.'
                        : 'Podés justificarlas desde esta sección.'
                      : 'Podés informar o justificar el motivo desde el portal.'
                  }
                  accion={
                    <Button
                      type="button"
                      className={PORTAL_PRIMARY_BUTTON_CLASS}
                      onClick={() =>
                        abrirFormulario(
                          seccionAsistencia === 'pendientes' ? 'justificar' : 'informar',
                          seccionAsistencia === 'pendientes'
                            ? asistenciasPendientes[0]?.fecha
                            : undefined,
                        )
                      }
                    >
                      <CirclePlusIcon aria-hidden="true" className="size-4" />
                      {seccionAsistencia === 'pendientes'
                        ? 'Justificar ausencia'
                        : 'Informar o justificar ausencia'}
                    </Button>
                  }
                />
              )}
              <div
                role="tablist"
                aria-label="Sección de asistencias"
                className="flex flex-wrap gap-1 border-b border-[#E7DDF1]"
              >
                {opcionesSeccion.map(({ clave, etiqueta }) => {
                  const seleccionada = seccionAsistencia === clave
                  const Icono = iconoSeccion[clave]
                  return (
                    <button
                      key={clave}
                      id={`asistencias-tab-${clave}`}
                      type="button"
                      role="tab"
                      aria-selected={seleccionada}
                      aria-controls={`asistencias-panel-${clave}`}
                      className={`relative -mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${seleccionada ? 'border-[#7A2FA8] text-[#7A2FA8]' : 'border-transparent text-[#6B6478] hover:text-[#2B2338]'}`}
                      onClick={() => setSeccionAsistencia(clave)}
                    >
                      <Icono aria-hidden="true" className="size-4" />
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
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-[17px] font-semibold text-[#2B2338]">
                      Resumen del período
                    </h2>
                    {periodos.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] text-[#6B6478]">Período:</span>
                        <SelectorPeriodo
                          valor={periodoActivo}
                          periodos={periodos}
                          onChange={setPeriodoSeleccionado}
                          etiqueta="Período del resumen"
                        />
                      </div>
                    )}
                  </div>
                  {asistencias.length > 0 ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <PortalStatTile
                          label="Días presentes"
                          detalle="Asistencia registrada"
                          value={resumenPeriodo.presentes}
                          icon={CheckIcon}
                          tone="verde"
                        />
                        <PortalStatTile
                          label="Inasistencias"
                          detalle={`${resumenPeriodo.justificadas} ${
                            resumenPeriodo.justificadas === 1 ? 'justificada' : 'justificadas'
                          }`}
                          detalleClassName="font-medium text-[#B42318]"
                          value={resumenPeriodo.inasistencias}
                          icon={XIcon}
                          tone="rojo"
                        />
                        <PortalStatTile
                          label="Tardanzas"
                          detalle="Llegadas fuera de horario"
                          value={resumenPeriodo.tardanzas}
                          icon={ClockIcon}
                          tone="ambar"
                        />
                        <div className="flex flex-col justify-center gap-3 rounded-[22px] bg-white p-5 shadow-[0_10px_26px_rgba(24,16,40,0.08)]">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[15px] font-semibold text-[#2B2338]">
                              Asistencia del período
                            </p>
                          </div>
                          <p className="font-heading text-[26px] leading-none font-bold text-[#2B2338] tabular-nums">
                            {porcentajeAsistencia} %
                          </p>
                          <div
                            role="progressbar"
                            aria-valuenow={porcentajeAsistencia}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            className="h-2 w-full overflow-hidden rounded-full bg-[#EAE2F2]"
                          >
                            <div
                              className="h-full rounded-full bg-[#7A2FA8]"
                              style={{ width: `${porcentajeAsistencia}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 max-w-full overflow-hidden rounded-[18px] border border-[#EFE7F6] bg-white">
                        <div className="flex items-center gap-2 border-b border-[#F1EBF7] px-4 py-3">
                          <ListIcon aria-hidden="true" className="size-5 text-[#7A2FA8]" />
                          <h3 className="text-[15px] font-semibold text-[#2B2338]">
                            Últimos registros
                          </h3>
                        </div>
                        <div className="w-full min-w-0 overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-[#F7F3FB] text-left text-[13px] text-[#6B6478]">
                              <tr>
                                <th scope="col" className="px-4 py-2 font-semibold">
                                  Fecha
                                </th>
                                <th scope="col" className="px-4 py-2 font-semibold">
                                  Condición
                                </th>
                                <th
                                  scope="col"
                                  className="hidden px-4 py-2 font-semibold sm:table-cell"
                                >
                                  Justificación
                                </th>
                                <th
                                  scope="col"
                                  className="hidden px-4 py-2 font-semibold sm:table-cell"
                                >
                                  Observaciones
                                </th>
                                <th scope="col" className="px-4 py-2 text-right font-semibold">
                                  <span className="sr-only">Acciones</span>
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F1EBF7]">
                              {ultimosRegistros.map((asistencia) => {
                                const condicion = condicionAsistencia(asistencia)
                                const justificacion = justificacionVisible(asistencia)
                                return (
                                  <tr key={asistencia.id}>
                                    <td className="px-4 py-2 whitespace-nowrap text-[#3A2E45]">
                                      {fechaCorta(asistencia.fecha)}
                                    </td>
                                    <td className="px-4 py-2">
                                      <Badge variant={condicion.variante}>
                                        {condicion.etiqueta}
                                      </Badge>
                                    </td>
                                    <td className="hidden px-4 py-2 sm:table-cell">
                                      {justificacion === 'Sin justificar' ? (
                                        <Badge variant="advertencia">Sin justificar</Badge>
                                      ) : (
                                        <span className="text-[#3A2E45]">{justificacion}</span>
                                      )}
                                    </td>
                                    <td className="hidden max-w-[220px] truncate px-4 py-2 text-[#6B6478] sm:table-cell">
                                      {asistencia.justificacion_observacion ?? '—'}
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                      <button
                                        type="button"
                                        aria-label={`Ver el registro del ${fechaCorta(asistencia.fecha)} en el historial`}
                                        className="inline-flex size-8 items-center justify-center rounded-full text-[#6B6478] transition-colors hover:bg-[#F5EFFA] hover:text-[#7A2FA8]"
                                        onClick={() => setSeccionAsistencia('historial')}
                                      >
                                        <MoreHorizontalIcon aria-hidden="true" className="size-4" />
                                      </button>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="rounded-[16px] border border-dashed border-[#E4D9F0] bg-[#FBF9FD] p-4 text-sm text-[#6B6478]">
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
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-[17px] font-semibold text-[#2B2338]">
                        {esAsistencias ? 'Justificaciones' : 'Pendientes'}
                      </h2>
                      {esAsistencias && (
                        <p className="mt-1 text-sm text-[#6B6478]">
                          Gestioná las ausencias: justificá las pendientes y revisá el estado de las
                          solicitudes enviadas.
                        </p>
                      )}
                    </div>
                    {esAsistencias && (
                      <Button
                        variant="secondary"
                        className="rounded-full"
                        onClick={() => abrirFormulario('informar')}
                      >
                        Informar ausencia
                      </Button>
                    )}
                  </div>

                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div
                      role="group"
                      aria-label="Filtrar justificaciones"
                      className="flex flex-wrap gap-2"
                    >
                      {[
                        { clave: 'todas', etiqueta: 'Todas' },
                        {
                          clave: 'pendientes',
                          etiqueta: `Pendientes (${pendientesJustificacion.length})`,
                        },
                        {
                          clave: 'enviadas',
                          etiqueta: `Enviadas (${enviadasJustificacion.length})`,
                        },
                      ].map(({ clave, etiqueta }) => (
                        <button
                          key={clave}
                          type="button"
                          aria-pressed={filtroJustificacion === clave}
                          onClick={() =>
                            setFiltroJustificacion(clave as 'todas' | 'pendientes' | 'enviadas')
                          }
                          className={`min-h-9 rounded-full px-4 text-[14px] font-semibold transition-colors ${
                            filtroJustificacion === clave
                              ? 'bg-[#F1E4FB] text-[#7A2FA8]'
                              : 'text-[#3A2E45] hover:bg-[#F7F2FC]'
                          }`}
                        >
                          {etiqueta}
                        </button>
                      ))}
                    </div>

                    <div className="ml-auto flex flex-wrap items-center gap-2">
                      {periodosJustificacion.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] text-[#6B6478]">Período:</span>
                          <SelectorPeriodo
                            valor={periodoJustificacionActivo}
                            periodos={periodosJustificacion}
                            onChange={setPeriodoJustificacion}
                            etiqueta="Período de las justificaciones"
                          />
                        </div>
                      )}
                      <div className="relative w-full sm:w-56">
                        <SearchIcon
                          aria-hidden="true"
                          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8C8599]"
                        />
                        <Input
                          aria-label="Buscar por motivo"
                          placeholder="Buscar por motivo..."
                          value={busquedaJustificacion}
                          onChange={(evento) => setBusquedaJustificacion(evento.target.value)}
                          className="h-10 rounded-full bg-white pl-9 text-[14px]"
                        />
                      </div>
                    </div>
                  </div>

                  {pendientesJustificacion.length > 0 && filtroJustificacion !== 'enviadas' && (
                    <div className="mb-4 overflow-hidden rounded-[16px] border border-[#EFE7F6]">
                      <div className="flex items-center gap-2 bg-[#F7F3FB] px-4 py-2.5">
                        <ClockIcon aria-hidden="true" className="size-4 text-[#D98A2B]" />
                        <h3 className="text-[15px] font-semibold text-[#2B2338]">
                          Pendientes de justificar ({pendientesJustificacion.length})
                        </h3>
                      </div>
                      <div className="w-full overflow-x-auto">
                        <table className="w-full min-w-[520px] text-sm">
                          <thead className="bg-white text-left text-[13px] text-[#6B6478]">
                            <tr>
                              <th scope="col" className="px-4 py-2 font-semibold">
                                Fecha / Período
                              </th>
                              <th scope="col" className="px-4 py-2 font-semibold">
                                Tipo
                              </th>
                              <th scope="col" className="px-4 py-2 font-semibold">
                                Estado
                              </th>
                              <th scope="col" className="px-4 py-2 text-right font-semibold">
                                Acciones
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#F1EBF7]">
                            {pendientesJustificacion.map((asistencia) => (
                              <tr key={asistencia.id}>
                                <td className="px-4 py-2.5 whitespace-nowrap text-[#3A2E45]">
                                  {formatearFecha(asistencia.fecha)}
                                </td>
                                <td className="px-4 py-2.5 text-[#3A2E45]">Inasistencia</td>
                                <td className="px-4 py-2.5">
                                  <Badge variant="advertencia">Sin justificar</Badge>
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="rounded-full"
                                    onClick={() => abrirFormulario('justificar', asistencia.fecha)}
                                  >
                                    Justificar
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {enviadasJustificacion.length > 0 && filtroJustificacion !== 'pendientes' && (
                    <div className="overflow-hidden rounded-[16px] border border-[#EFE7F6]">
                      <div className="flex items-center gap-2 bg-[#F7F3FB] px-4 py-2.5">
                        <CheckIcon aria-hidden="true" className="size-4 text-[#0F7A4D]" />
                        <h3 className="text-[15px] font-semibold text-[#2B2338]">
                          Justificaciones enviadas ({enviadasJustificacion.length})
                        </h3>
                      </div>
                      <div className="w-full overflow-x-auto">
                        <table className="w-full min-w-[640px] text-sm">
                          <thead className="bg-white text-left text-[13px] text-[#6B6478]">
                            <tr>
                              <th scope="col" className="px-4 py-2 font-semibold">
                                Fecha / Período
                              </th>
                              <th scope="col" className="px-4 py-2 font-semibold">
                                Tipo
                              </th>
                              <th scope="col" className="px-4 py-2 font-semibold">
                                Motivo
                              </th>
                              <th scope="col" className="px-4 py-2 font-semibold">
                                Enviada el
                              </th>
                              <th scope="col" className="px-4 py-2 font-semibold">
                                Estado
                              </th>
                              <th scope="col" className="px-4 py-2 text-right font-semibold">
                                Acciones
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#F1EBF7]">
                            {enviadasJustificacion.map((solicitud) => (
                              <tr key={solicitud.id}>
                                <td className="px-4 py-2.5 whitespace-nowrap text-[#3A2E45]">
                                  {rangoPeriodo(solicitud)}
                                </td>
                                <td className="px-4 py-2.5 text-[#3A2E45]">Inasistencia</td>
                                <td className="px-4 py-2.5 text-[#3A2E45]">
                                  {etiquetaMotivoJustificacion(solicitud.motivo)}
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap text-[#6B6478]">
                                  {formatearFechaHora(solicitud.fecha_carga)}
                                </td>
                                <td className="px-4 py-2.5">
                                  <Badge
                                    variant={VARIANTE_ESTADO_SOLICITUD_PERIODO[solicitud.estado]}
                                  >
                                    {etiquetaEstadoSolicitud(solicitud.estado)}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="rounded-full"
                                    onClick={() =>
                                      setDetalleJustificacion({ tipo: 'enviada', solicitud })
                                    }
                                  >
                                    Ver detalle
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {pendientesJustificacion.length === 0 && filtroJustificacion !== 'enviadas' ? (
                    <p className="rounded-[16px] border border-dashed border-[#E4D9F0] bg-[#FBF9FD] p-4 text-sm text-[#6B6478]">
                      No tenés ausencias pendientes de justificar.
                    </p>
                  ) : null}

                  <Sheet
                    open={detalleJustificacion !== null}
                    onOpenChange={(abierto) => {
                      if (!abierto) setDetalleJustificacion(null)
                    }}
                  >
                    <SheetContent
                      side="right"
                      className="portal-familia w-full overflow-y-auto sm:max-w-md"
                    >
                      {detalleJustificacion?.tipo === 'pendiente' ? (
                        <>
                          <SheetHeader>
                            <SheetTitle className="text-[20px]">Detalle de ausencia</SheetTitle>
                            <SheetDescription>
                              {formatearFecha(detalleJustificacion.asistencia.fecha)} ·{' '}
                              {nombreAlumno}
                            </SheetDescription>
                          </SheetHeader>
                          <div className="flex flex-col gap-4 px-4 pb-6">
                            <Badge variant="advertencia">Sin justificar</Badge>
                            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                              <dt className="text-[#6B6478]">Alumno</dt>
                              <dd className="text-[#2B2338]">{nombreAlumno}</dd>
                              <dt className="text-[#6B6478]">Fecha</dt>
                              <dd className="text-[#2B2338]">
                                {formatearFecha(detalleJustificacion.asistencia.fecha)}
                              </dd>
                              <dt className="text-[#6B6478]">Tipo</dt>
                              <dd className="text-[#2B2338]">Inasistencia</dd>
                            </dl>
                            <Button
                              className={PORTAL_PRIMARY_BUTTON_CLASS}
                              onClick={() => {
                                abrirFormulario('justificar', detalleJustificacion.asistencia.fecha)
                                setDetalleJustificacion(null)
                              }}
                            >
                              Justificar ausencia
                            </Button>
                          </div>
                        </>
                      ) : detalleJustificacion?.tipo === 'enviada' ? (
                        <>
                          <SheetHeader>
                            <SheetTitle className="text-[20px]">
                              Detalle de justificación
                            </SheetTitle>
                            <SheetDescription className="uppercase">
                              #{detalleJustificacion.solicitud.id.slice(0, 4)}
                            </SheetDescription>
                          </SheetHeader>
                          <div className="flex flex-col gap-5 px-4 pb-6">
                            <Badge
                              variant={
                                VARIANTE_ESTADO_SOLICITUD_PERIODO[
                                  detalleJustificacion.solicitud.estado
                                ]
                              }
                            >
                              {etiquetaEstadoSolicitud(detalleJustificacion.solicitud.estado)}
                            </Badge>

                            <section>
                              <h3 className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-[#2B2338]">
                                <FileTextIcon
                                  aria-hidden="true"
                                  className="size-4 text-[#7A2FA8]"
                                />
                                Información general
                              </h3>
                              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                                <dt className="text-[#6B6478]">Alumno</dt>
                                <dd className="text-[#2B2338]">{nombreAlumno}</dd>
                                <dt className="text-[#6B6478]">Período de ausencia</dt>
                                <dd className="text-[#2B2338]">
                                  {rangoPeriodo(detalleJustificacion.solicitud)}
                                </dd>
                                <dt className="text-[#6B6478]">Fecha de envío</dt>
                                <dd className="text-[#2B2338]">
                                  {formatearFechaHora(detalleJustificacion.solicitud.fecha_carga)}
                                </dd>
                                <dt className="text-[#6B6478]">Canal</dt>
                                <dd className="text-[#2B2338]">Portal de Familia</dd>
                              </dl>
                            </section>

                            <section>
                              <h3 className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-[#2B2338]">
                                <StickyNoteIcon
                                  aria-hidden="true"
                                  className="size-4 text-[#7A2FA8]"
                                />
                                Motivo informado
                              </h3>
                              <p className="rounded-[12px] bg-[#FBF9FD] p-3 text-sm text-[#3A2E45]">
                                {etiquetaMotivoJustificacion(detalleJustificacion.solicitud.motivo)}
                                {detalleJustificacion.solicitud.observacion
                                  ? ` ${detalleJustificacion.solicitud.observacion}`
                                  : ''}
                              </p>
                            </section>

                            {detalleJustificacion.solicitud.archivo_nombre && (
                              <section>
                                <h3 className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-[#2B2338]">
                                  <PaperclipIcon
                                    aria-hidden="true"
                                    className="size-4 text-[#7A2FA8]"
                                  />
                                  Comprobante adjunto
                                </h3>
                                <Button
                                  variant="secondary"
                                  className="w-full justify-start rounded-[12px]"
                                  onClick={() =>
                                    void descargarComprobanteSolicitudAusencia(
                                      detalleJustificacion.solicitud.id,
                                      detalleJustificacion.solicitud.archivo_nombre ??
                                        'comprobante',
                                    )
                                  }
                                >
                                  <DownloadIcon aria-hidden="true" />
                                  {detalleJustificacion.solicitud.archivo_nombre}
                                </Button>
                              </section>
                            )}

                            <section>
                              <h3 className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-[#2B2338]">
                                <CheckIcon aria-hidden="true" className="size-4 text-[#7A2FA8]" />
                                Revisión
                              </h3>
                              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                                <dt className="text-[#6B6478]">Resultado</dt>
                                <dd>
                                  <Badge
                                    variant={
                                      VARIANTE_ESTADO_SOLICITUD_PERIODO[
                                        detalleJustificacion.solicitud.estado
                                      ]
                                    }
                                  >
                                    {etiquetaEstadoSolicitud(detalleJustificacion.solicitud.estado)}
                                  </Badge>
                                </dd>
                                <dt className="text-[#6B6478]">Fecha de revisión</dt>
                                <dd className="text-[#2B2338]">
                                  {formatearFechaHora(
                                    detalleJustificacion.solicitud.fecha_resolucion,
                                  )}
                                </dd>
                                {detalleJustificacion.solicitud.observacion_resolucion && (
                                  <>
                                    <dt className="text-[#6B6478]">Observación</dt>
                                    <dd className="text-[#2B2338]">
                                      {detalleJustificacion.solicitud.observacion_resolucion}
                                    </dd>
                                  </>
                                )}
                              </dl>
                            </section>

                            {detalleJustificacion.solicitud.estado === 'pendiente' && (
                              <Button
                                variant="secondary"
                                className="rounded-full"
                                onClick={() => {
                                  void cancelarSolicitud(detalleJustificacion.solicitud)
                                  setDetalleJustificacion(null)
                                }}
                              >
                                Cancelar solicitud
                              </Button>
                            )}
                          </div>
                        </>
                      ) : null}
                    </SheetContent>
                  </Sheet>
                </section>
              ) : (
                <section
                  id="asistencias-panel-historial"
                  role="tabpanel"
                  aria-labelledby="asistencias-tab-historial"
                  tabIndex={0}
                >
                  <h2 className="mb-2 text-sm font-semibold text-[#2B2338]">Historial</h2>
                  {asistenciasHistorial.length > 0 ? (
                    <>
                      <div className="mb-4 grid gap-3 rounded-[16px] border border-[#EFE5F7] bg-[#F7F2FC] p-3 sm:grid-cols-2 lg:grid-cols-4">
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
                          <div className="divide-y divide-[#F0EAF6] overflow-hidden rounded-[16px] border border-[#F0EAF6] bg-[#FBF9FD]">
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
                                    <span className="text-right text-[#6B6478]">
                                      {etiquetaAsistencia(asistencia)}
                                    </span>
                                    {iconoEstadoJustificacion(asistencia.justificacion_estado)}
                                    {!asistencia.justificacion_id &&
                                      cubiertaPorPeriodo(asistencia.fecha) && (
                                        <span className="text-xs text-[#8C8599]">
                                          Cubierta por solicitud
                                        </span>
                                      )}
                                    {asistencia.justificacion_id && (
                                      <button
                                        type="button"
                                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[#6B6478] transition-colors hover:bg-[#F5EFFA] hover:text-[#7A2FA8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A2FA8]"
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
                                      className="mt-2 rounded-[12px] bg-[#F5EFFA] p-2.5 text-xs text-[#6B6478]"
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
                                          className="mt-2 inline-flex items-center gap-1 font-semibold text-[#7A2FA8] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A2FA8]"
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
                              className="mt-3 flex items-center justify-between gap-3 text-xs text-[#6B6478]"
                              aria-label="Paginación del historial"
                            >
                              <Button
                                variant="secondary"
                                size="sm"
                                className="rounded-full"
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
                                className="rounded-full"
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
                        <p className="rounded-[16px] border border-dashed border-[#E4D9F0] bg-[#FBF9FD] p-4 text-sm text-[#6B6478]">
                          No hay registros que coincidan con los filtros seleccionados.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="rounded-[16px] border border-dashed border-[#E4D9F0] bg-[#FBF9FD] p-4 text-sm text-[#6B6478]">
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
        </PortalCard>
      </div>
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
