import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  ConstructionIcon,
  DownloadIcon,
  PaperclipIcon,
  XIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { FileRejection } from 'react-dropzone'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { Dropzone } from '@/components/dropzone'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useMisAlumnos } from '@/modules/familias-alumnos/hooks/use-mis-alumnos'
import { listarAsistenciasFamilia } from '@/modules/academico/services/listar-asistencias-familia'
import { justificarAsistenciaFamilia } from '@/modules/academico/services/justificar-asistencia-familia'
import { descargarComprobanteJustificacionFamilia } from '@/modules/academico/services/descargar-comprobante-justificacion-familia'
import type { AsistenciaFamilia } from '@/modules/academico/types'

const MOTIVOS_JUSTIFICACION = [
  'Enfermedad',
  'Consulta médica',
  'Trámite familiar',
  'Fuerza mayor',
  'Otro',
]
const TIPOS_COMPROBANTE = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
}
const MAX_TAMANIO_COMPROBANTE = 5 * 1024 * 1024

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
}

type SeccionAsistencia = 'resumen' | 'pendientes' | 'historial'

type ResumenAsistencias = {
  presentes: number
  inasistencias: number
  tardanzas: number
}

function resumirAsistencias(asistencias: AsistenciaFamilia[]): ResumenAsistencias {
  return asistencias.reduce<ResumenAsistencias>(
    (resumen, asistencia) => {
      if (asistencia.tipo === 'presente') resumen.presentes += 1
      else if (asistencia.tipo === 'tardanza') resumen.tardanzas += 1
      else resumen.inasistencias += 1
      return resumen
    },
    { presentes: 0, inasistencias: 0, tardanzas: 0 },
  )
}

// Estos trámites tienen una pantalla propia para completar el flujo del portal sin reutilizar
// vistas de backoffice. Su operación se habilitará cuando existan endpoints que autoricen a la
// familia sólo sobre sus alumnos vinculados.
export function PortalFamiliaTramitePage({
  titulo,
  descripcion,
  seccionInicial,
}: PortalFamiliaTramitePageProps) {
  const esAsistencias = titulo === 'Asistencias'
  const esJustificacion = esAsistencias || titulo === 'Justificar una ausencia'
  const { alumnos } = useMisAlumnos(esJustificacion)
  const [asistencias, setAsistencias] = useState<AsistenciaFamilia[]>([])
  const [alumnoId, setAlumnoId] = useState('')
  const [asistenciaAJustificar, setAsistenciaAJustificar] = useState<string | null>(null)
  const [motivoSeleccionado, setMotivoSeleccionado] = useState('')
  const [motivoOtro, setMotivoOtro] = useState('')
  const [observacion, setObservacion] = useState('')
  const [comprobante, setComprobante] = useState<File | undefined>()
  const [errorComprobante, setErrorComprobante] = useState<string | null>(null)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [detalleExpandido, setDetalleExpandido] = useState<string | null>(null)
  const [seccionAsistencia, setSeccionAsistencia] = useState<SeccionAsistencia>(
    seccionInicial ?? (esAsistencias ? 'resumen' : 'pendientes'),
  )
  const alumnoSeleccionado = alumnoId || alumnos[0]?.alumno_id || ''
  const asistenciasPendientes = asistencias.filter(esPendiente)
  const asistenciasHistorial = asistencias.filter((asistencia) => !esPendiente(asistencia))
  const resumenAsistencias = resumirAsistencias(asistencias)
  const opcionesSeccion: Array<{ clave: SeccionAsistencia; etiqueta: string }> = esAsistencias
    ? [
        { clave: 'resumen', etiqueta: 'Resumen' },
        { clave: 'pendientes', etiqueta: 'Justificar asistencia' },
        { clave: 'historial', etiqueta: 'Historial' },
      ]
    : [
        { clave: 'pendientes', etiqueta: 'Pendientes' },
        { clave: 'historial', etiqueta: 'Historial' },
      ]
  useEffect(() => {
    if (alumnoSeleccionado)
      listarAsistenciasFamilia(alumnoSeleccionado)
        .then(setAsistencias)
        .catch(() => setAsistencias([]))
  }, [alumnoSeleccionado])
  async function enviarJustificacion() {
    const motivo = motivoSeleccionado === 'Otro' ? motivoOtro.trim() : motivoSeleccionado
    if (!asistenciaAJustificar || !motivo.trim()) return
    setGuardando(true)
    setErrorEnvio(null)
    try {
      const justificacion = await justificarAsistenciaFamilia(
        asistenciaAJustificar,
        motivo,
        observacion.trim(),
        comprobante,
      )
      setAsistencias((actuales) =>
        actuales.map((asistencia) =>
          asistencia.id === justificacion.asistencia_id
            ? {
                ...asistencia,
                justificacion_id: justificacion.id,
                justificacion_estado: justificacion.estado,
              }
            : asistencia,
        ),
      )
      cerrarFormulario()
      toast.success('Justificación enviada. Quedará en revisión.')
      if (alumnoSeleccionado) {
        listarAsistenciasFamilia(alumnoSeleccionado)
          .then(setAsistencias)
          .catch(() => undefined)
      }
    } catch (causa) {
      const mensaje =
        causa instanceof ApiError
          ? (causa.detail ?? 'No se pudo enviar la justificación.')
          : 'No se pudo enviar la justificación. Intentá de nuevo.'
      setErrorEnvio(mensaje)
      toast.error(mensaje)
    } finally {
      setGuardando(false)
    }
  }
  function adjuntarComprobante(archivos: File[], rechazos: FileRejection[]) {
    if (rechazos.length > 0) {
      setErrorComprobante('El comprobante debe ser PDF, JPG o PNG y pesar como máximo 5 MB.')
      return
    }
    setComprobante(archivos[0])
    setErrorComprobante(null)
  }
  function cerrarFormulario() {
    setAsistenciaAJustificar(null)
    setMotivoSeleccionado('')
    setMotivoOtro('')
    setObservacion('')
    setComprobante(undefined)
    setErrorComprobante(null)
    setErrorEnvio(null)
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
        <p className="text-xs font-bold tracking-[.06em] text-texto-3 uppercase">
          Portal de familia
        </p>
        <h1 className="mt-1 font-heading text-2xl font-semibold text-texto">{titulo}</h1>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>{titulo}</CardTitle>
          <CardDescription>{descripcion}</CardDescription>
        </CardHeader>
        <CardContent>
          {esJustificacion && alumnos.length > 0 ? (
            <div className="flex flex-col gap-4">
              <label className="text-sm font-semibold">
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
              <div
                role="tablist"
                aria-label="Sección de asistencias"
                className={`grid gap-1 rounded-lg bg-fila-hover p-1 ${opcionesSeccion.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}
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
                      <article className="rounded-lg border border-borde bg-superficie p-4">
                        <div className="flex items-center gap-2 text-sm text-texto-2">
                          <CheckIcon className="size-4 text-exito" aria-hidden="true" />
                          Asistencias
                        </div>
                        <p className="mt-2 text-2xl font-semibold text-texto">
                          {resumenAsistencias.presentes}
                        </p>
                      </article>
                      <article className="rounded-lg border border-borde bg-superficie p-4">
                        <div className="flex items-center gap-2 text-sm text-texto-2">
                          <XIcon className="size-4 text-error" aria-hidden="true" />
                          Inasistencias
                        </div>
                        <p className="mt-2 text-2xl font-semibold text-texto">
                          {resumenAsistencias.inasistencias}
                        </p>
                      </article>
                      <article className="rounded-lg border border-borde bg-superficie p-4">
                        <div className="flex items-center gap-2 text-sm text-texto-2">
                          <ClockIcon className="size-4 text-advertencia" aria-hidden="true" />
                          Tardanzas
                        </div>
                        <p className="mt-2 text-2xl font-semibold text-texto">
                          {resumenAsistencias.tardanzas}
                        </p>
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
                            {!asistencia.justificacion_estado && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setAsistenciaAJustificar(asistencia.id)
                                  setErrorEnvio(null)
                                }}
                              >
                                Justificar
                              </Button>
                            )}
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
              ) : (
                <section
                  id="asistencias-panel-historial"
                  role="tabpanel"
                  aria-labelledby="asistencias-tab-historial"
                  tabIndex={0}
                >
                  <h2 className="mb-2 text-sm font-semibold text-texto">Historial</h2>
                  {asistenciasHistorial.length > 0 ? (
                    <div className="divide-y divide-borde rounded-lg border border-borde">
                      {asistenciasHistorial.map((asistencia) => {
                        const detalleId = `justificacion-detalle-${asistencia.id}`
                        const expandido = detalleExpandido === asistencia.id
                        return (
                          <div
                            key={asistencia.id}
                            className="p-3 text-sm first:rounded-t-lg last:rounded-b-lg"
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
                                className="mt-3 rounded-lg bg-fila-hover p-3 text-xs text-texto-2"
                              >
                                <p>
                                  <strong>Motivo:</strong>{' '}
                                  {asistencia.justificacion_motivo ?? 'Otro'}
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
      <Dialog
        open={Boolean(asistenciaAJustificar)}
        onOpenChange={(abierto) => {
          if (!abierto) cerrarFormulario()
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Justificar ausencia</DialogTitle>
            <DialogDescription>
              Informá el motivo y adjuntá el comprobante correspondiente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <label className="block text-sm">
              Motivo
              <select
                className="mt-1 w-full rounded-lg border border-borde bg-superficie p-2"
                value={motivoSeleccionado}
                onChange={(e) => setMotivoSeleccionado(e.target.value)}
              >
                <option value="" disabled>
                  Seleccioná un motivo
                </option>
                {MOTIVOS_JUSTIFICACION.map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {opcion}
                  </option>
                ))}
              </select>
            </label>
            {motivoSeleccionado === 'Otro' && (
              <label className="mt-3 block text-sm">
                Especificá el motivo
                <input
                  className="mt-1 w-full rounded-lg border border-borde bg-superficie p-2"
                  value={motivoOtro}
                  onChange={(e) => setMotivoOtro(e.target.value)}
                />
              </label>
            )}
            <label className="mt-3 block text-sm">
              Observación
              <textarea
                className="mt-1 w-full rounded-lg border border-borde bg-superficie p-2"
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
              />
            </label>
            <div className="mt-3">
              <p className="text-sm">Adjuntar comprobante (opcional)</p>
              <Dropzone
                accept={TIPOS_COMPROBANTE}
                maxSize={MAX_TAMANIO_COMPROBANTE}
                onDrop={adjuntarComprobante}
                label={
                  comprobante
                    ? comprobante.name
                    : 'Arrastrá el comprobante o hacé clic para adjuntar'
                }
                hint="PDF, JPG o PNG · Máximo 5 MB"
                className="mt-1"
              />
              {comprobante && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-texto-2">
                  <PaperclipIcon className="size-3.5" aria-hidden="true" />
                  {comprobante.name}
                </p>
              )}
              {errorComprobante && <p className="mt-2 text-xs text-error">{errorComprobante}</p>}
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" onClick={cerrarFormulario}>
                Cancelar
              </Button>
              <Button
                disabled={
                  !(motivoSeleccionado === 'Otro' ? motivoOtro.trim() : motivoSeleccionado) ||
                  guardando
                }
                onClick={() => void enviarJustificacion()}
              >
                Enviar justificación
              </Button>
            </div>
            {errorEnvio && (
              <p className="mt-3 text-sm text-error" role="alert">
                {errorEnvio}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
