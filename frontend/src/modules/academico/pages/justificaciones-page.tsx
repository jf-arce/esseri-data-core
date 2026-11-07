import {
  CheckIcon,
  ClipboardListIcon,
  ClockIcon,
  DownloadIcon,
  ShieldAlertIcon,
  XIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { BackLink } from '@/components/back-link'
import { FilterBar, FilterBarSpacer, FilterSearch } from '@/components/filter-bar'
import { FilterDropdown, type FilterDropdownOption } from '@/components/filter-dropdown'
import { PageHeader } from '@/components/page-header'
import { PaginadorServidor } from '@/components/paginador-servidor'
import { StatTile } from '@/components/stat-tile'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { descargarExport } from '@/lib/descargar-export'
import {
  listarJustificaciones,
  obtenerOpcionesJustificaciones,
  resolverJustificacion,
  type FiltrosJustificaciones,
} from '@/modules/academico/services/justificaciones'
import type {
  EstadoJustificacion,
  JustificacionFamilia,
  JustificacionesPaginadas,
  OpcionJustificacion,
} from '@/modules/academico/types'
import { etiquetaMotivoJustificacion } from '@/modules/academico/utils'

const TAMANIO_PAGINA = 20

const VARIANTE_ESTADO: Record<EstadoJustificacion, 'advertencia' | 'exito' | 'error'> = {
  pendiente: 'advertencia',
  aprobada: 'exito',
  rechazada: 'error',
}

const ETIQUETA_ESTADO: Record<EstadoJustificacion, string> = {
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
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

export function JustificacionesPage() {
  const [filtros, setFiltros] = useState<FiltrosJustificaciones>({
    estado: 'pendiente',
    pagina: 1,
    tamanio_pagina: TAMANIO_PAGINA,
  })
  const [busqueda, setBusqueda] = useState('')
  const [datos, setDatos] = useState<JustificacionesPaginadas | null>(null)
  const [opciones, setOpciones] = useState<OpcionJustificacion[]>([])
  const [claveCargada, setClaveCargada] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [sinPermiso, setSinPermiso] = useState(false)
  const [rechazo, setRechazo] = useState<JustificacionFamilia | null>(null)
  const [observacionRechazo, setObservacionRechazo] = useState('')
  const [resolviendo, setResolviendo] = useState(false)

  // `cargando` se deriva de la clave consultada para no llamar setState en el cuerpo del efecto
  // (evita renders en cascada): el estado inicial ya arranca como "cargando".
  const claveConsulta = `${JSON.stringify(filtros)}|${revision}`
  const cargando = claveCargada !== claveConsulta

  useEffect(() => {
    let activo = true
    listarJustificaciones(filtros)
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
              : 'No se pudieron cargar las justificaciones. Intentá de nuevo.',
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

  const recargar = () => setRevision((anterior) => anterior + 1)

  useEffect(() => {
    obtenerOpcionesJustificaciones()
      .then(setOpciones)
      .catch(() => setOpciones([]))
  }, [])

  // La búsqueda se aplica con debounce para no pedir una página por cada tecla.
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

  const actualizarFiltros = (cambios: Partial<FiltrosJustificaciones>) => {
    setFiltros((previo) => ({ ...previo, ...cambios, pagina: 1 }))
  }

  const nivelOptions: FilterDropdownOption[] = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const opcion of opciones) {
      mapa.set(opcion.nivel_educativo_id, opcion.nivel_educativo_nombre)
    }
    return Array.from(mapa, ([value, label]) => ({ value, label }))
  }, [opciones])

  const divisionOptions: FilterDropdownOption[] = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const opcion of opciones) {
      if (filtros.nivel_id && opcion.nivel_educativo_id !== filtros.nivel_id) continue
      mapa.set(opcion.division_id, opcion.division_nombre)
    }
    return Array.from(mapa, ([value, label]) => ({ value, label })).sort((a, b) =>
      a.label.localeCompare(b.label, 'es'),
    )
  }, [opciones, filtros.nivel_id])

  const hayFiltros =
    Boolean(filtros.nivel_id) ||
    Boolean(filtros.division_id) ||
    Boolean(filtros.fecha_desde) ||
    Boolean(filtros.fecha_hasta) ||
    Boolean(filtros.busqueda)

  const resumen = datos?.resumen
  const items = datos?.items ?? []
  const estadoActivo = filtros.estado ?? 'todas'

  const limpiarFiltros = () => {
    setBusqueda('')
    setFiltros({ estado: 'pendiente', pagina: 1, tamanio_pagina: TAMANIO_PAGINA })
  }

  const aprobar = async (item: JustificacionFamilia) => {
    setResolviendo(true)
    try {
      await resolverJustificacion(item.id, true)
      toast.success('Justificación aprobada.')
      recargar()
    } catch (fallo) {
      toast.error(
        fallo instanceof Error ? fallo.message : 'No se pudo aprobar la justificación.',
      )
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
      await resolverJustificacion(rechazo.id, false, observacion)
      toast.success('Justificación rechazada.')
      setRechazo(null)
      setObservacionRechazo('')
      recargar()
    } catch (fallo) {
      toast.error(
        fallo instanceof Error ? fallo.message : 'No se pudo rechazar la justificación.',
      )
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
        <EmptyTitle>No tenés permiso para ver las justificaciones.</EmptyTitle>
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
      <PageHeader titulo="Justificaciones" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
          label="Total"
          value={resumen?.total ?? 0}
          icon={ClipboardListIcon}
          cargando={cargando && !datos}
        />
      </div>

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar las justificaciones</AlertTitle>
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
            estado: valor === 'todas' ? undefined : (valor as EstadoJustificacion),
          })
        }
      >
        <TabsList>
          <TabsTrigger value="pendiente">
            Pendientes
            <span className="text-texto-3">{resumen?.pendientes ?? 0}</span>
          </TabsTrigger>
          <TabsTrigger value="aprobada">
            Aprobadas
            <span className="text-texto-3">{resumen?.aprobadas ?? 0}</span>
          </TabsTrigger>
          <TabsTrigger value="rechazada">
            Rechazadas
            <span className="text-texto-3">{resumen?.rechazadas ?? 0}</span>
          </TabsTrigger>
          <TabsTrigger value="todas">
            Todas
            <span className="text-texto-3">{resumen?.total ?? 0}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <FilterBar>
        <FilterSearch
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar alumno por nombre o apellido"
        />
        {nivelOptions.length > 0 && (
          <FilterDropdown
            label="Nivel"
            options={[{ value: 'todos', label: 'Todos' }, ...nivelOptions]}
            value={filtros.nivel_id ?? 'todos'}
            onChange={(valor) =>
              actualizarFiltros({
                nivel_id: valor === 'todos' ? undefined : valor,
                division_id: undefined,
              })
            }
            active={Boolean(filtros.nivel_id)}
          />
        )}
        {divisionOptions.length > 0 && (
          <FilterDropdown
            label="División"
            options={[{ value: 'todos', label: 'Todas' }, ...divisionOptions]}
            value={filtros.division_id ?? 'todos'}
            onChange={(valor) =>
              actualizarFiltros({ division_id: valor === 'todos' ? undefined : valor })
            }
            active={Boolean(filtros.division_id)}
          />
        )}
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
              ? 'No hay justificaciones pendientes para revisar.'
              : 'No hay justificaciones para los filtros seleccionados.'}
          </EmptyTitle>
          <EmptyDescription>
            {hayFiltros
              ? 'Probá quitando algún filtro o ampliando el período.'
              : 'Cuando una familia cargue una justificación, va a aparecer acá.'}
          </EmptyDescription>
        </Empty>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alumno</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Fecha de la falta</TableHead>
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
                  <TableCell>
                    {item.division_nombre ?? '—'}
                    {item.nivel_educativo_nombre && (
                      <span className="block text-xs text-texto-3">
                        {item.nivel_educativo_nombre}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatearFecha(item.fecha_asistencia)}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">
                      {etiquetaMotivoJustificacion(item.motivo)}
                    </span>
                    <span className="block max-w-[280px] truncate text-xs text-texto-2">
                      {item.observacion?.trim() || 'Sin observación de la familia'}
                    </span>
                    {item.archivo_nombre && (
                      <Button
                        variant="link"
                        className="mt-0.5 h-auto p-0 text-xs"
                        onClick={() =>
                          void descargarExport(
                            `/academico/justificaciones/${item.id}/archivo`,
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
                    <Badge variant={VARIANTE_ESTADO[item.estado]}>
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
                        <Button
                          size="sm"
                          disabled={resolviendo}
                          onClick={() => void aprobar(item)}
                        >
                          Aprobar
                        </Button>
                      </div>
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
              etiqueta="justificaciones"
              onCambiarPagina={(pagina) =>
                setFiltros((previo) => ({ ...previo, pagina }))
              }
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
            <DialogTitle>Rechazar justificación</DialogTitle>
            <DialogDescription>
              Vas a rechazar la justificación de {rechazo?.alumno_nombre}. La familia va a ver
              el motivo del rechazo.
            </DialogDescription>
          </DialogHeader>

          {rechazo && (
            <div className="rounded-lg border border-borde bg-fila-hover/60 p-3 text-sm">
              <p className="font-medium">
                {etiquetaMotivoJustificacion(rechazo.motivo)} ·{' '}
                {formatearFecha(rechazo.fecha_asistencia)}
              </p>
              <p className="mt-1 text-texto-2">
                {rechazo.observacion?.trim() || 'La familia no dejó una observación.'}
              </p>
            </div>
          )}

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Motivo del rechazo (obligatorio)
            <Textarea
              value={observacionRechazo}
              onChange={(evento) => setObservacionRechazo(evento.target.value)}
              maxLength={500}
              autoFocus
              placeholder="Explicá por qué no se acepta la justificación."
            />
          </label>

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
    </div>
  )
}
