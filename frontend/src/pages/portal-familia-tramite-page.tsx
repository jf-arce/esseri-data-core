import { ArrowLeftIcon, CheckIcon, ConstructionIcon, PaperclipIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { FileRejection } from 'react-dropzone'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { Dropzone } from '@/components/dropzone'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Button } from '@/components/ui/button'
import { useMisAlumnos } from '@/modules/familias-alumnos/hooks/use-mis-alumnos'
import { listarAsistenciasFamilia } from '@/modules/academico/services/listar-asistencias-familia'
import { justificarAsistenciaFamilia } from '@/modules/academico/services/justificar-asistencia-familia'
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

function etiquetaAsistencia(tipo: string) {
  const etiquetas: Record<string, string> = {
    presente: 'Presente',
    tardanza: 'Tardanza',
    ausente_pendiente: 'Ausente pendiente',
    ausente_justificado: 'Ausente justificado',
    ausente_injustificado: 'Ausente injustificado',
  }
  return etiquetas[tipo] ?? tipo.replaceAll('_', ' ')
}

type PortalFamiliaTramitePageProps = {
  titulo: string
  descripcion: string
}

// Estos trámites tienen una pantalla propia para completar el flujo del portal sin reutilizar
// vistas de backoffice. Su operación se habilitará cuando existan endpoints que autoricen a la
// familia sólo sobre sus alumnos vinculados.
export function PortalFamiliaTramitePage({ titulo, descripcion }: PortalFamiliaTramitePageProps) {
  const esJustificacion = titulo === 'Justificar una ausencia'
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
  const alumnoSeleccionado = alumnoId || alumnos[0]?.alumno_id || ''
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
      setAsistenciaAJustificar(null)
      setMotivoSeleccionado('')
      setMotivoOtro('')
      setObservacion('')
      setComprobante(undefined)
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
              <div className="divide-y divide-borde">
                {asistencias.map((asistencia) => (
                  <div key={asistencia.id} className="flex items-center gap-3 py-3 text-sm">
                    <span className="flex-1">
                      {new Date(`${asistencia.fecha}T00:00:00`).toLocaleDateString('es-AR')}
                    </span>
                    <span className="text-texto-2">{etiquetaAsistencia(asistencia.tipo)}</span>
                    {asistencia.tipo === 'ausente_pendiente' &&
                      asistencia.justificacion_estado === 'pendiente' && (
                        <span className="font-medium text-violeta">En revisión</span>
                      )}
                    {asistencia.tipo === 'ausente_pendiente' &&
                      !asistencia.justificacion_estado && (
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
                    {asistencia.tipo === 'ausente_justificado' && (
                      <CheckIcon className="size-4 text-exito" aria-label="Justificada" />
                    )}
                  </div>
                ))}
              </div>
              {asistenciaAJustificar && (
                <div className="rounded-card bg-fila-hover p-4">
                  <p className="mb-3 text-sm font-semibold">Justificar ausencia</p>
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
                    {errorComprobante && (
                      <p className="mt-2 text-xs text-error">{errorComprobante}</p>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setAsistenciaAJustificar(null)
                        setMotivoSeleccionado('')
                        setMotivoOtro('')
                        setObservacion('')
                        setComprobante(undefined)
                        setErrorComprobante(null)
                        setErrorEnvio(null)
                      }}
                    >
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
    </section>
  )
}
