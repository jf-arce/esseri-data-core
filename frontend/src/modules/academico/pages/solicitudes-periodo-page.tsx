import {
  BanIcon,
  CheckIcon,
  ClipboardListIcon,
  ClockIcon,
  DownloadIcon,
  ShieldAlertIcon,
  XIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { BackLink } from '@/components/back-link'
import { FilterBar, FilterBarSpacer, FilterSearch } from '@/components/filter-bar'
import { PageHeader } from '@/components/page-header'
import { PaginadorServidor } from '@/components/paginador-servidor'
import { StatTile } from '@/components/stat-tile'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  descargarComprobanteSolicitudPeriodoAdmin,
  listarSolicitudesPeriodo,
  resolverSolicitudPeriodo,
  revocarSolicitudPeriodo,
} from '@/modules/academico/services/solicitudes-periodo-admin'
import type {
  EstadoSolicitudPeriodo,
  FiltrosSolicitudesPeriodo,
  SolicitudAusenciaPeriodoAdmin,
  SolicitudesPeriodoPaginadas,
} from '@/modules/academico/types'
import {
  etiquetaMotivoJustificacion,
  VARIANTE_ESTADO_SOLICITUD_PERIODO,
} from '@/modules/academico/utils'

const TAMANIO_PAGINA = 20

const ETIQUETA_ESTADO: Record<EstadoSolicitudPeriodo, string> = {
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
  revocada: 'Revocada',
}

function formatearFecha(iso: string): string {
  return new Intl.DateTimeFormat('es-AR').format(new Date(`${iso}T00:00:00`))
}

function formatearFechaHora(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso))
}

export function SolicitudesPeriodoPage() {
  const [filtros, setFiltros] = useState<FiltrosSolicitudesPeriodo>({
    estado: 'pendiente',
    pagina: 1,
    tamanio_pagina: TAMANIO_PAGINA,
  })
  const [busqueda, setBusqueda] = useState('')
  const [datos, setDatos] = useState<SolicitudesPeriodoPaginadas | null>(null)
  const [claveCargada, setClaveCargada] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [sinPermiso, setSinPermiso] = useState(false)
  const [resolviendo, setResolviendo] = useState(false)
  const [rechazo, setRechazo] = useState<SolicitudAusenciaPeriodoAdmin | null>(null)
  const [observacionRechazo, setObservacionRechazo] = useState('')
  const [revocacion, setRevocacion] = useState<SolicitudAusenciaPeriodoAdmin | null>(null)
  const [motivoRevocacion, setMotivoRevocacion] = useState('')
  const [notificarFamilia, setNotificarFamilia] = useState(false)

  const claveConsulta = `${JSON.stringify(filtros)}|${revision}`
  const cargando = claveCargada !== claveConsulta

  useEffect(() => {
    let activo = true
    listarSolicitudesPeriodo(filtros)
      .then((resultado) => {
        if (!activo) return
        setDatos(resultado)
        setError(null)
        setSinPermiso(false)
      })
      .catch((fallo: unknown) => {
        if (!activo) return
        if (fallo instanceof ApiError && fallo.status === 403) {
          setSinPermiso(true)
        } else {
          setError(
            fallo instanceof Error
              ? fallo.message
              : 'No se pudieron cargar las solicitudes. Intentá de nuevo.',
          )
        }
      })
      .finally(() => {
        if (activo) setClaveCargada(claveConsulta)
      })
    return () => {
      activo = false
    }
  }, [filtros, claveConsulta])

  useEffect(() => {
    const temporizador = setTimeout(() => {
      setFiltros((previo) => {
        const valor = busqueda.trim() || undefined
        if (previo.busqueda === valor) return previo
        return { ...previo, busqueda: valor, pagina: 1 }
      })
    }, 300)
    return () => clearTimeout(temporizador)
  }, [busqueda])

  const recargar = () => setRevision((anterior) => anterior + 1)
  const actualizarFiltros = (cambios: Partial<FiltrosSolicitudesPeriodo>) => {
    setFiltros((previo) => ({ ...previo, ...cambios, pagina: 1 }))
  }

  const resumen = datos?.resumen
  const items = datos?.items ?? []
  const estadoActivo = filtros.estado ?? 'todas'
  const hayFiltros =
    Boolean(filtros.fecha_desde) || Boolean(filtros.fecha_hasta) || Boolean(filtros.busqueda)

  const limpiarFiltros = () => {
    setBusqueda('')
    setFiltros({ estado: 'pendiente', pagina: 1, tamanio_pagina: TAMANIO_PAGINA })
  }

  const aprobar = async (solicitud: SolicitudAusenciaPeriodoAdmin) => {
    setResolviendo(true)
    try {
      await resolverSolicitudPeriodo(solicitud.id, true)
      toast.success('Solicitud aprobada.')
      recargar()
    } catch (fallo) {
      toast.error(fallo instanceof Error ? fallo.message : 'No se pudo aprobar la solicitud.')
    } finally {
      setResolviendo(false)
    }
  }

  const confirmarRechazo = async () => {
    if (!rechazo) return
    const observacion = observacionRechazo.trim()
    if (!observacion) return
    setResolviendo(true)
    try {
      await resolverSolicitudPeriodo(rechazo.id, false, observacion)
      toast.success('Solicitud rechazada.')
      setRechazo(null)
      setObservacionRechazo('')
      recargar()
    } catch (fallo) {
      toast.error(fallo instanceof Error ? fallo.message : 'No se pudo rechazar la solicitud.')
    } finally {
      setResolviendo(false)
    }
  }

  const confirmarRevocacion = async () => {
    if (!revocacion) return
    const motivo = motivoRevocacion.trim()
    if (!motivo) return
    setResolviendo(true)
    try {
      await revocarSolicitudPeriodo(revocacion.id, motivo, notificarFamilia)
      toast.success(
        notificarFamilia
          ? 'Solicitud revocada. Se enviará el aviso a la familia.'
          : 'Solicitud revocada.',
      )
      setRevocacion(null)
      setMotivoRevocacion('')
      setNotificarFamilia(false)
      recargar()
    } catch (fallo) {
      toast.error(fallo instanceof Error ? fallo.message : 'No se pudo revocar la solicitud.')
    } finally {
      setResolviendo(false)
    }
  }

  if (sinPermiso) {
    return (
      <Empty className="min-h-[420px] rounded-panel bg-superficie shadow-card">
        <EmptyMedia variant="neutral">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>No tenés permiso para ver las solicitudes por período.</EmptyTitle>
        <EmptyDescription>
          Solicitá acceso a la bandeja institucional de justificaciones a una persona
          administradora.
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <BackLink to="/academico" label="Volver a Académico" />
      <PageHeader titulo="Solicitudes por período" />
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" asChild>
          <Link to="/academico/justificaciones">Ver justificaciones individuales</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile
          variant="dark"
          label="Pendientes"
          value={resumen?.pendientes ?? 0}
          icon={ClockIcon}
          cargando={cargando && !datos}
        />
        <StatTile
          label="Aprobadas"
          value={resumen?.aprobadas ?? 0}
          icon={CheckIcon}
          iconClassName="bg-exito-suave text-exito"
          cargando={cargando && !datos}
        />
        <StatTile
          label="Rechazadas"
          value={resumen?.rechazadas ?? 0}
          icon={XIcon}
          iconClassName="bg-error-suave text-error"
          cargando={cargando && !datos}
        />
        <StatTile
          label="Canceladas"
          value={resumen?.canceladas ?? 0}
          icon={BanIcon}
          cargando={cargando && !datos}
        />
        <StatTile
          label="Revocadas"
          value={resumen?.revocadas ?? 0}
          icon={ClipboardListIcon}
          cargando={cargando && !datos}
        />
      </div>

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar las solicitudes</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs
        value={estadoActivo}
        onValueChange={(valor) =>
          actualizarFiltros({
            estado: valor === 'todas' ? undefined : (valor as EstadoSolicitudPeriodo),
          })
        }
      >
        <TabsList>
          <TabsTrigger value="pendiente">
            Pendientes <span className="text-texto-3">{resumen?.pendientes ?? 0}</span>
          </TabsTrigger>
          <TabsTrigger value="aprobada">
            Aprobadas <span className="text-texto-3">{resumen?.aprobadas ?? 0}</span>
          </TabsTrigger>
          <TabsTrigger value="rechazada">
            Rechazadas <span className="text-texto-3">{resumen?.rechazadas ?? 0}</span>
          </TabsTrigger>
          <TabsTrigger value="cancelada">
            Canceladas <span className="text-texto-3">{resumen?.canceladas ?? 0}</span>
          </TabsTrigger>
          <TabsTrigger value="revocada">
            Revocadas <span className="text-texto-3">{resumen?.revocadas ?? 0}</span>
          </TabsTrigger>
          <TabsTrigger value="todas">
            Todas <span className="text-texto-3">{resumen?.total ?? 0}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <FilterBar>
        <FilterSearch
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar alumno por nombre o apellido"
        />
        <Input
          type="date"
          aria-label="Fecha desde"
          className="h-10 w-[150px]"
          value={filtros.fecha_desde ?? ''}
          onChange={(evento) =>
            actualizarFiltros({ fecha_desde: evento.target.value || undefined })
          }
        />
        <Input
          type="date"
          aria-label="Fecha hasta"
          className="h-10 w-[150px]"
          value={filtros.fecha_hasta ?? ''}
          onChange={(evento) =>
            actualizarFiltros({ fecha_hasta: evento.target.value || undefined })
          }
        />
        <FilterBarSpacer />
        {hayFiltros && (
          <Button variant="ghost" size="sm" onClick={limpiarFiltros}>
            Limpiar filtros
          </Button>
        )}
      </FilterBar>

      {cargando && !datos ? (
        <div className="rounded-panel bg-superficie p-6 shadow-card">
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4, 5].map((fila) => (
              <div key={fila} className="h-11 animate-pulse rounded bg-fila-hover" />
            ))}
          </div>
        </div>
      ) : items.length === 0 ? (
        <Empty className="min-h-[280px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-sup-academico text-info">
            <ClipboardListIcon />
          </EmptyMedia>
          <EmptyTitle>
            {estadoActivo === 'pendiente' && !hayFiltros
              ? 'No hay solicitudes pendientes para revisar.'
              : 'No hay solicitudes para los filtros seleccionados.'}
          </EmptyTitle>
          <EmptyDescription>
            {hayFiltros
              ? 'Probá quitando algún filtro o ampliando el período.'
              : 'Cuando una familia informe una ausencia por período, va a aparecer acá.'}
          </EmptyDescription>
        </Empty>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alumno</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead data-align="end">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{item.alumno_nombre}</span>
                      <span className="text-xs text-texto-3">
                        Cargada el {formatearFechaHora(item.fecha_carga)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatearFecha(item.fecha_inicio)}
                    {item.fecha_fin !== item.fecha_inicio
                      ? ` — ${formatearFecha(item.fecha_fin)}`
                      : ''}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{etiquetaMotivoJustificacion(item.motivo)}</span>
                    <span className="block max-w-[280px] truncate text-xs text-texto-2">
                      {item.observacion?.trim() || 'Sin observación de la familia'}
                    </span>
                    {item.observacion_resolucion && (
                      <span className="block max-w-[280px] truncate text-xs text-texto-3">
                        Resolución: {item.observacion_resolucion}
                      </span>
                    )}
                    {item.archivo_nombre && (
                      <Button
                        variant="link"
                        className="mt-0.5 h-auto p-0 text-xs"
                        onClick={() =>
                          void descargarComprobanteSolicitudPeriodoAdmin(
                            item.id,
                            item.archivo_nombre ?? 'comprobante',
                          )
                        }
                      >
                        <DownloadIcon data-icon="inline-start" />
                        {item.archivo_nombre}
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={VARIANTE_ESTADO_SOLICITUD_PERIODO[item.estado]}>
                      {ETIQUETA_ESTADO[item.estado]}
                    </Badge>
                  </TableCell>
                  <TableCell data-align="end">
                    {item.estado === 'pendiente' ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={resolviendo}
                          onClick={() => {
                            setRechazo(item)
                            setObservacionRechazo('')
                          }}
                        >
                          Rechazar
                        </Button>
                        <Button size="sm" disabled={resolviendo} onClick={() => void aprobar(item)}>
                          Aprobar
                        </Button>
                      </div>
                    ) : item.estado === 'aprobada' ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={resolviendo}
                        onClick={() => {
                          setRevocacion(item)
                          setMotivoRevocacion('')
                          setNotificarFamilia(false)
                        }}
                      >
                        Revocar
                      </Button>
                    ) : (
                      <span className="text-xs text-texto-3">
                        {item.fecha_resolucion
                          ? `Resuelta el ${formatearFechaHora(item.fecha_resolucion)}`
                          : '—'}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {datos && (
            <PaginadorServidor
              pagina={datos.pagina}
              tamanioPagina={datos.tamanio_pagina}
              total={datos.total}
              totalPaginas={datos.total_paginas}
              etiqueta="solicitudes"
              onCambiarPagina={(pagina) => setFiltros((previo) => ({ ...previo, pagina }))}
            />
          )}
        </>
      )}

      <Dialog
        open={rechazo !== null}
        onOpenChange={(abierto) => {
          if (!abierto) {
            setRechazo(null)
            setObservacionRechazo('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar solicitud por período</DialogTitle>
            <DialogDescription>
              Vas a rechazar la solicitud de {rechazo?.alumno_nombre}. La familia va a ver el motivo
              del rechazo.
            </DialogDescription>
          </DialogHeader>

          {rechazo && (
            <div className="rounded-lg border border-borde bg-fila-hover/60 p-3 text-sm">
              <p className="font-medium">
                {etiquetaMotivoJustificacion(rechazo.motivo)} ·{' '}
                {formatearFecha(rechazo.fecha_inicio)}
                {rechazo.fecha_fin !== rechazo.fecha_inicio
                  ? ` — ${formatearFecha(rechazo.fecha_fin)}`
                  : ''}
              </p>
              <p className="mt-1 text-texto-2">
                {rechazo.observacion?.trim() || 'La familia no dejó una observación.'}
              </p>
            </div>
          )}

          <Field>
            <FieldLabel htmlFor="solicitud-periodo-rechazo">
              Motivo del rechazo (obligatorio)
            </FieldLabel>
            <Textarea
              id="solicitud-periodo-rechazo"
              required
              value={observacionRechazo}
              onChange={(evento) => setObservacionRechazo(evento.target.value)}
              maxLength={500}
              autoFocus
              placeholder="Explicá por qué no se acepta la solicitud."
            />
          </Field>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setRechazo(null)
                setObservacionRechazo('')
              }}
            >
              Cancelar
            </Button>
            <Button
              disabled={!observacionRechazo.trim() || resolviendo}
              onClick={() => void confirmarRechazo()}
            >
              Confirmar rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revocacion !== null}
        onOpenChange={(abierto) => {
          if (!abierto) {
            setRevocacion(null)
            setMotivoRevocacion('')
            setNotificarFamilia(false)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revocar solicitud por período</DialogTitle>
            <DialogDescription>
              Vas a revocar la solicitud de {revocacion?.alumno_nombre}. Se retiran solo las
              aplicaciones originadas por esta solicitud.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="solicitud-periodo-revocacion">
                Motivo de la revocación (obligatorio)
              </FieldLabel>
              <Textarea
                id="solicitud-periodo-revocacion"
                required
                value={motivoRevocacion}
                onChange={(evento) => setMotivoRevocacion(evento.target.value)}
                maxLength={500}
                autoFocus
                placeholder="Explicá por qué se revoca la solicitud."
              />
            </Field>

            <Field orientation="horizontal">
              <Checkbox
                id="solicitud-periodo-notificar-familia"
                checked={notificarFamilia}
                onCheckedChange={(valor) => setNotificarFamilia(valor === true)}
              />
              <FieldLabel htmlFor="solicitud-periodo-notificar-familia">
                Notificar a la familia con este motivo
              </FieldLabel>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setRevocacion(null)
                setMotivoRevocacion('')
                setNotificarFamilia(false)
              }}
            >
              Cancelar
            </Button>
            <Button
              disabled={!motivoRevocacion.trim() || resolviendo}
              onClick={() => void confirmarRevocacion()}
            >
              Confirmar revocación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
