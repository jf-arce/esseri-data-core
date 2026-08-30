import { useEffect, useState } from 'react'
import { CheckIcon, ChevronLeftIcon, FilePlus2Icon, XIcon } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import {
  actualizarDocumentoSolicitudAdmision,
  aprobarSolicitudAdmision,
  avanzarSolicitudAdmision,
  obtenerSolicitudAdmision,
  rechazarSolicitudAdmision,
  registrarDocumentoSolicitudAdmision,
} from '@/modules/inscripciones/services/solicitudes-admision'
import type { SolicitudAdmision } from '@/modules/inscripciones/types'
import {
  etiquetaEstadoSolicitud,
  etiquetaEtapaSolicitud,
  formatearFechaInscripcion,
} from '@/modules/inscripciones/utils'

function mensajeError(error: unknown) {
  return error instanceof ApiError
    ? error.detail
    : 'No pudimos actualizar la solicitud. Revisá tu conexión e intentá de nuevo.'
}

function varianteEstado(estado: SolicitudAdmision['estado']) {
  if (estado === 'aprobada') return 'exito' as const
  if (estado === 'rechazada') return 'error' as const
  if (estado === 'desistida') return 'neutro' as const
  return 'advertencia' as const
}

export function SolicitudAdmisionPage() {
  const { solicitudId } = useParams<{ solicitudId: string }>()
  const navigate = useNavigate()
  const [resultado, setResultado] = useState<{
    solicitud: SolicitudAdmision | null
    error: string | null
  }>({ solicitud: null, error: null })
  const [enviando, setEnviando] = useState(false)
  const [observaciones, setObservaciones] = useState('')
  const [tipoDocumento, setTipoDocumento] = useState('')
  const [archivo, setArchivo] = useState('')

  useEffect(() => {
    if (!solicitudId) return
    const controller = new AbortController()
    obtenerSolicitudAdmision(solicitudId, controller.signal)
      .then((solicitud) => setResultado({ solicitud, error: null }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setResultado({ solicitud: null, error: mensajeError(error) })
      })
    return () => controller.abort()
  }, [solicitudId])

  const solicitud = resultado.solicitud

  async function ejecutarAccion(accion: 'avanzar' | 'aprobar' | 'rechazar') {
    if (!solicitud) return
    setEnviando(true)
    try {
      const actualizar = {
        avanzar: avanzarSolicitudAdmision,
        aprobar: aprobarSolicitudAdmision,
        rechazar: rechazarSolicitudAdmision,
      }[accion]
      const actualizada = await actualizar(solicitud.id, observaciones)
      setResultado({ solicitud: actualizada, error: null })
      setObservaciones('')
      toast.success(
        accion === 'aprobar'
          ? 'Solicitud aprobada.'
          : accion === 'rechazar'
            ? 'Solicitud rechazada.'
            : 'Etapa actualizada.',
      )
    } catch (error) {
      setResultado((actual) => ({ ...actual, error: mensajeError(error) }))
    } finally {
      setEnviando(false)
    }
  }

  async function recargarDetalle() {
    if (!solicitud) return
    const actualizada = await obtenerSolicitudAdmision(solicitud.id)
    setResultado({ solicitud: actualizada, error: null })
  }

  async function agregarDocumento() {
    if (!solicitud || !tipoDocumento.trim() || !archivo.trim()) return
    setEnviando(true)
    try {
      await registrarDocumentoSolicitudAdmision(solicitud.id, tipoDocumento, archivo)
      await recargarDetalle()
      setTipoDocumento('')
      setArchivo('')
      toast.success('Documento agregado.')
    } catch (error) {
      setResultado((actual) => ({ ...actual, error: mensajeError(error) }))
    } finally {
      setEnviando(false)
    }
  }

  async function validarDocumento(documentoId: string, estado: 'validado' | 'rechazado') {
    if (!solicitud) return
    setEnviando(true)
    try {
      await actualizarDocumentoSolicitudAdmision(solicitud.id, documentoId, estado)
      await recargarDetalle()
      toast.success(estado === 'validado' ? 'Documento validado.' : 'Documento rechazado.')
    } catch (error) {
      setResultado((actual) => ({ ...actual, error: mensajeError(error) }))
    } finally {
      setEnviando(false)
    }
  }

  const permiteResolver =
    solicitud?.estado === 'en_proceso' && solicitud.etapa === 'evaluacion_aprobacion'
  const permiteAvanzar =
    solicitud?.estado === 'en_proceso' &&
    solicitud.etapa !== 'evaluacion_aprobacion' &&
    solicitud.etapa !== 'documentacion_contrato' &&
    solicitud.etapa !== 'inscripcion_confirmada'
  const permiteDocumentos =
    solicitud?.estado === 'aprobada' && solicitud.etapa === 'documentacion_contrato'

  if (!solicitud && !resultado.error) {
    return <Spinner className="mx-auto my-24" />
  }

  if (!solicitud) {
    return (
      <Alert variant="error">
        <AlertTitle>No se pudo abrir la solicitud</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3">
          {resultado.error}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/inscripciones/admisiones')}
          >
            Volver a Admisiones
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Button className="w-fit" variant="ghost" size="sm" asChild>
          <Link to="/inscripciones/admisiones">
            <ChevronLeftIcon data-icon="inline-start" />
            Admisiones
          </Link>
        </Button>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold tracking-[.08em] text-texto-3 uppercase">
              Inscripciones
            </p>
            <h1 className="mt-1 text-2xl font-semibold">
              Solicitud de {solicitud.aspirante.apellido}, {solicitud.aspirante.nombre}
            </h1>
            <p className="mt-1 text-sm text-texto-2">
              Admisiones /{' '}
              <span className="font-medium text-texto">
                {solicitud.aspirante.apellido}, {solicitud.aspirante.nombre}
              </span>
            </p>
          </div>
          {permiteResolver && (
            <div className="flex gap-2">
              <Button
                variant="destructive"
                disabled={enviando}
                onClick={() => ejecutarAccion('rechazar')}
              >
                <XIcon data-icon="inline-start" />
                Rechazar
              </Button>
              <Button disabled={enviando} onClick={() => ejecutarAccion('aprobar')}>
                <CheckIcon data-icon="inline-start" />
                Aprobar solicitud
              </Button>
            </div>
          )}
        </div>
      </div>

      {resultado.error && (
        <Alert variant="error">
          <AlertTitle>No se pudo completar la acción</AlertTitle>
          <AlertDescription>{resultado.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,1fr)]">
        <div className="flex flex-col gap-5">
          <section className="overflow-hidden rounded-panel bg-superficie shadow-card">
            <div className="flex items-center justify-between border-b border-borde px-5 py-4">
              <h2 className="font-semibold">Datos de la solicitud</h2>
              <Badge variant={varianteEstado(solicitud.estado)}>
                {etiquetaEtapaSolicitud(solicitud.etapa)}
              </Badge>
            </div>
            <dl className="grid gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-[132px_1fr]">
              <dt className="text-texto-2">Aspirante</dt>
              <dd className="font-medium">
                {solicitud.aspirante.apellido}, {solicitud.aspirante.nombre}
              </dd>
              <dt className="text-texto-2">Ciclo lectivo</dt>
              <dd className="font-medium">{solicitud.ciclo_lectivo}</dd>
              <dt className="text-texto-2">Contacto</dt>
              <dd className="font-medium">
                {solicitud.contacto
                  ? `${solicitud.contacto.apellido}, ${solicitud.contacto.nombre}${solicitud.contacto.telefono ? ` · ${solicitud.contacto.telefono}` : ''}`
                  : 'Sin contacto informado'}
              </dd>
              <dt className="text-texto-2">Fecha de solicitud</dt>
              <dd className="font-medium">
                {formatearFechaInscripcion(solicitud.fecha_solicitud)}
              </dd>
            </dl>
          </section>

          <section className="overflow-hidden rounded-panel bg-superficie shadow-card">
            <div className="border-b border-borde px-5 py-4">
              <h2 className="font-semibold">Historial del proceso</h2>
            </div>
            <ol className="m-5 space-y-3 border-l border-borde pl-4">
              {solicitud.etapas.length === 0 ? (
                <li className="relative">
                  <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-violeta" />
                  <p className="font-medium">{etiquetaEtapaSolicitud(solicitud.etapa)}</p>
                  <p className="text-xs text-texto-3">
                    Estado actual: {etiquetaEstadoSolicitud(solicitud.estado)}
                  </p>
                  <p className="mt-1 text-texto-2">
                    Esta solicitud no tiene etapas históricas registradas.
                  </p>
                </li>
              ) : (
                solicitud.etapas.map((etapa) => (
                  <li key={etapa.id} className="relative">
                    <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-violeta" />
                    <p className="font-medium">{etiquetaEtapaSolicitud(etapa.etapa)}</p>
                    <p className="text-xs text-texto-3">
                      {etapa.estado.replace('_', ' ')} ·{' '}
                      {new Date(etapa.fecha).toLocaleDateString('es-AR')}
                    </p>
                    {etapa.observaciones && (
                      <p className="mt-1 text-texto-2">{etapa.observaciones}</p>
                    )}
                  </li>
                ))
              )}
            </ol>
          </section>

          {(permiteAvanzar || permiteResolver) && (
            <section className="rounded-panel bg-superficie p-5 shadow-card">
              <Field>
                <FieldLabel htmlFor="observaciones-admision">Notas de la etapa</FieldLabel>
                <Textarea
                  id="observaciones-admision"
                  value={observaciones}
                  onChange={(event) => setObservaciones(event.target.value)}
                  placeholder="Registrá el resultado de la entrevista, postulación o evaluación."
                  disabled={enviando}
                />
              </Field>
              {permiteAvanzar && (
                <Button
                  className="mt-4"
                  disabled={enviando}
                  onClick={() => ejecutarAccion('avanzar')}
                >
                  {enviando && <Spinner data-icon="inline-start" />}Guardar y avanzar
                </Button>
              )}
            </section>
          )}
        </div>

        <aside className="h-fit rounded-panel bg-superficie shadow-card">
          <div className="border-b border-borde px-5 py-4">
            <h2 className="font-semibold">Documentación</h2>
          </div>
          <div className="p-5">
            {permiteDocumentos ? (
              <>
                <div className="space-y-2">
                  {solicitud.documentos.length === 0 ? (
                    <p className="text-sm text-texto-3">Todavía no se cargaron documentos.</p>
                  ) : (
                    solicitud.documentos.map((documento) => (
                      <div key={documento.id} className="rounded-lg border border-borde p-3">
                        <p className="font-medium">{documento.tipo_documento}</p>
                        <p className="text-xs text-texto-3">{documento.archivo}</p>
                        {documento.estado === 'pendiente' ? (
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={enviando}
                              onClick={() => validarDocumento(documento.id, 'rechazado')}
                            >
                              Rechazar
                            </Button>
                            <Button
                              size="sm"
                              disabled={enviando}
                              onClick={() => validarDocumento(documento.id, 'validado')}
                            >
                              Validar
                            </Button>
                          </div>
                        ) : (
                          <Badge
                            className="mt-2"
                            variant={documento.estado === 'validado' ? 'exito' : 'error'}
                          >
                            {documento.estado === 'validado' ? 'Validado' : 'Rechazado'}
                          </Badge>
                        )}
                      </div>
                    ))
                  )}
                </div>
                <FieldGroup className="mt-4">
                  <Field>
                    <FieldLabel htmlFor="tipo-documento">Tipo</FieldLabel>
                    <Input
                      id="tipo-documento"
                      value={tipoDocumento}
                      onChange={(event) => setTipoDocumento(event.target.value)}
                      placeholder="DNI, contrato…"
                      disabled={enviando}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="archivo-documento">Archivo o referencia</FieldLabel>
                    <Input
                      id="archivo-documento"
                      value={archivo}
                      onChange={(event) => setArchivo(event.target.value)}
                      placeholder="dni-aspirante.pdf"
                      disabled={enviando}
                    />
                  </Field>
                </FieldGroup>
                <Button
                  className="mt-3"
                  variant="secondary"
                  size="sm"
                  disabled={enviando || !tipoDocumento.trim() || !archivo.trim()}
                  onClick={agregarDocumento}
                >
                  <FilePlus2Icon data-icon="inline-start" />
                  Agregar documento
                </Button>
              </>
            ) : (
              <p className="text-sm text-texto-2">
                La documentación se gestiona al llegar a esa etapa del proceso.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
