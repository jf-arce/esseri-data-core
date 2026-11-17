import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  LayoutGridIcon,
  MapIcon,
  PlusIcon,
  ShieldAlertIcon,
  TableIcon,
  WorkflowIcon,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { FilterBar, FilterBarSpacer, FilterSearch } from '@/components/filter-bar'
import { FilterDropdown } from '@/components/filter-dropdown'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { PaginadorServidor } from '@/components/paginador-servidor'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  PERMISO_WORKFLOWS_ACTUALIZAR,
  PERMISO_WORKFLOWS_CREAR,
  tienePermiso,
} from '@/modules/auth/constants'
import { ActividadEnVivo } from '@/modules/workflows/components/actividad-en-vivo'
import { AtencionWorkflows } from '@/modules/workflows/components/atencion-workflows'
import { EjecucionDetalleSheet } from '@/modules/workflows/components/ejecucion-detalle-sheet'
import { MapaAutomatizaciones } from '@/modules/workflows/components/mapa-automatizaciones'
import { IndicadorEjecuciones } from '@/modules/workflows/components/indicador-ejecuciones'
import { RechazoEjecucionDialog } from '@/modules/workflows/components/rechazo-ejecucion-dialog'
import { ReglasWorkflowTabla } from '@/modules/workflows/components/reglas-workflow-tabla'
import { TarjetaRegla } from '@/modules/workflows/components/tarjeta-regla'
import {
  CLAVE_VISTA_REGLAS,
  DIAS_RESUMEN,
  FILTRO_ACTIVAS,
  FILTRO_INACTIVAS,
  FILTRO_TODOS,
  RUTA_NUEVA_REGLA,
  TAMANIO_PAGINA_TABLA,
  TAMANIO_PAGINA_TARJETAS,
  VISTAS_REGLAS,
} from '@/modules/workflows/constants'
import { useActividadWorkflows } from '@/modules/workflows/hooks/use-actividad-workflows'
import { useCatalogosWorkflow } from '@/modules/workflows/hooks/use-catalogos-workflow'
import { useDecisionesEjecucion } from '@/modules/workflows/hooks/use-decisiones-ejecucion'
import { useEjecucionesWorkflow } from '@/modules/workflows/hooks/use-ejecuciones-workflow'
import { usePantallaAncha } from '@/modules/workflows/hooks/use-pantalla-ancha'
import { useReglasWorkflow } from '@/modules/workflows/hooks/use-reglas-workflow'
import { useResumenWorkflows } from '@/modules/workflows/hooks/use-resumen-workflows'
import { actualizarReglaWorkflow } from '@/modules/workflows/services/actualizar-regla-workflow'
import type { EjecucionWorkflow, ReglaWorkflow } from '@/modules/workflows/types'
import {
  esEstadoReglaFiltro,
  etiquetaEvento,
  filtrarReglas,
  type EstadoReglaFiltro,
} from '@/modules/workflows/utils'
import { reglasQueRequierenAtencion } from '@/modules/workflows/utils-mapa'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

type Vista = (typeof VISTAS_REGLAS)[number]

const VISTAS: { valor: Vista; etiqueta: string; Icono: LucideIcon }[] = [
  { valor: 'tarjetas', etiqueta: 'Tarjetas', Icono: LayoutGridIcon },
  { valor: 'tabla', etiqueta: 'Tabla', Icono: TableIcon },
  { valor: 'mapa', etiqueta: 'Mapa', Icono: MapIcon },
]

const OPCIONES_ESTADO: { value: EstadoReglaFiltro; label: string }[] = [
  { value: FILTRO_TODOS, label: 'Todos' },
  { value: FILTRO_ACTIVAS, label: 'Activas' },
  { value: FILTRO_INACTIVAS, label: 'Inactivas' },
]

function esVista(valor: string | null): valor is Vista {
  return VISTAS_REGLAS.some((vista) => vista === valor)
}

/** La vista elegida se recuerda en este navegador. El almacenamiento puede no estar disponible
 * (ventana privada, datos bloqueados): en ese caso la página funciona igual, sin recordarla. */
function leerVista(): Vista {
  try {
    const guardada = window.localStorage.getItem(CLAVE_VISTA_REGLAS)
    return esVista(guardada) ? guardada : 'tarjetas'
  } catch {
    return 'tarjetas'
  }
}

function guardarVista(vista: Vista) {
  try {
    window.localStorage.setItem(CLAVE_VISTA_REGLAS, vista)
  } catch {
    // Sin almacenamiento: la vista vale solo para esta sesión.
  }
}

export function ReglasWorkflowPage() {
  const navigate = useNavigate()
  const permisos = useAuthStore(permisosActivos)
  const puedeCrear = tienePermiso(permisos, PERMISO_WORKFLOWS_CREAR)
  const puedeActualizar = tienePermiso(permisos, PERMISO_WORKFLOWS_ACTUALIZAR)
  const { reglas, cargando, error, sinPermiso, recargar, reemplazar } = useReglasWorkflow()
  const ancha = usePantallaAncha()
  const { tiposEvento } = useCatalogosWorkflow()
  const resumen = useResumenWorkflows()
  const actividad = useActividadWorkflows()
  const pendientes = useEjecucionesWorkflow({ estado: 'pendiente', pagina: 1, tamanioPagina: 5 })
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<EstadoReglaFiltro>(FILTRO_TODOS)
  const [tipoEventoId, setTipoEventoId] = useState(FILTRO_TODOS)
  const [vista, setVista] = useState<Vista>(leerVista)
  const [pagina, setPagina] = useState(1)
  const [detalle, setDetalle] = useState<EjecucionWorkflow | null>(null)

  const decisiones = useDecisionesEjecucion({
    onTerminar: () => {
      pendientes.recargar()
      resumen.recargar()
      void actividad.refrescar()
    },
    onResultado: (resultado) =>
      setDetalle((actual) => (actual?.id === resultado.id ? resultado : actual)),
  })

  async function cambiarActivo(regla: ReglaWorkflow) {
    // Optimista: el switch responde al instante y se revierte si el backend falla.
    reemplazar({ ...regla, activo: !regla.activo })
    try {
      reemplazar(await actualizarReglaWorkflow(regla.id, { activo: !regla.activo }))
      toast.success(regla.activo ? 'Regla desactivada' : 'Regla activada')
      resumen.recargar()
    } catch (causa) {
      reemplazar(regla)
      toast.error(causa instanceof ApiError ? causa.detail : 'No se pudo actualizar la regla.')
    }
  }

  function duplicar(regla: ReglaWorkflow) {
    navigate(`${RUTA_NUEVA_REGLA}?duplicar=${regla.id}`)
  }

  function elegirVista(valor: string) {
    if (!esVista(valor)) return
    setVista(valor)
    setPagina(1)
    guardarVista(valor)
  }

  if (sinPermiso)
    return (
      <Empty className="min-h-[420px] rounded-panel bg-superficie shadow-card">
        <EmptyMedia variant="neutral">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>No tenés permiso para ver las reglas de automatización.</EmptyTitle>
        <EmptyDescription>Solicitá acceso al módulo de Workflows.</EmptyDescription>
      </Empty>
    )

  const visibles = filtrarReglas(reglas, { busqueda, estado, tipoEventoId })
  const tamanioPagina = vista === 'tabla' ? TAMANIO_PAGINA_TABLA : TAMANIO_PAGINA_TARJETAS
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / tamanioPagina))
  const paginaActual = Math.min(pagina, totalPaginas)
  const deLaPagina = visibles.slice(
    (paginaActual - 1) * tamanioPagina,
    paginaActual * tamanioPagina,
  )
  const paginador = (
    <PaginadorServidor
      pagina={paginaActual}
      tamanioPagina={tamanioPagina}
      total={visibles.length}
      totalPaginas={totalPaginas}
      onCambiarPagina={setPagina}
      etiqueta="reglas"
    />
  )
  const sinReglas = !cargando && !error && reglas.length === 0
  const resumenPorRegla = new Map(
    resumen.resumen?.reglas.map((item) => [item.workflow_rule_id, item]),
  )
  const problemas = reglasQueRequierenAtencion(reglas, resumen.resumen?.reglas ?? [], DIAS_RESUMEN)
  const nuevaRegla = puedeCrear && (
    <Button asChild>
      <Link to={RUTA_NUEVA_REGLA}>
        <PlusIcon data-icon="inline-start" />
        Nueva regla
      </Link>
    </Button>
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader titulo="Reglas de automatización" accion={nuevaRegla} />
      <IndicadorEjecuciones resumen={resumen.resumen} cargando={resumen.cargando} />
      {resumen.error && (
        <Alert variant="error">
          <AlertTitle>No se pudo cargar el resumen</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {resumen.error}
            <Button variant="secondary" size="sm" onClick={resumen.recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-5 xl:grid-cols-2">
        <AtencionWorkflows
          pendientes={pendientes.datos.items.filter((item) => item.aprobable)}
          cargandoPendientes={pendientes.cargando}
          reglasConProblemas={problemas}
          puedeActualizar={puedeActualizar}
          decidiendoId={decisiones.decidiendoId}
          onAprobar={decisiones.aprobar}
          onRechazar={decisiones.setPorRechazar}
        />
        <ActividadEnVivo
          ejecuciones={actividad.ejecuciones}
          nuevas={actividad.nuevas}
          actualizadoEn={actividad.actualizadoEn}
          error={actividad.error}
          onAbrir={setDetalle}
        />
      </div>
      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar las reglas</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {sinReglas ? (
        <Empty className="min-h-[300px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-sup-workflows text-mod-workflows">
            <WorkflowIcon />
          </EmptyMedia>
          <EmptyTitle>Todavía no hay reglas de automatización.</EmptyTitle>
          <EmptyDescription>
            Una regla dispara acciones cuando ocurre un evento y se cumplen sus condiciones.
          </EmptyDescription>
          {nuevaRegla}
        </Empty>
      ) : (
        !error && (
          <Tabs
            value={vista}
            onValueChange={elegirVista}
            orientation={ancha ? 'vertical' : 'horizontal'}
            className="gap-4 lg:gap-6"
          >
            <TabsList
              variant="line"
              aria-label="Vista de las reglas"
              className="lg:w-44 lg:shrink-0 lg:self-start lg:border-r lg:border-b-0 lg:pr-2"
            >
              {VISTAS.map(({ valor, etiqueta, Icono }) => (
                <TabsTrigger key={valor} value={valor} className="mr-0 lg:px-2">
                  <Icono />
                  {etiqueta}
                  <span className="ml-auto text-xs font-normal text-texto-3 tabular-nums">
                    {visibles.length}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <FilterBar>
                <FilterSearch
                  value={busqueda}
                  onChange={(valor) => {
                    setBusqueda(valor)
                    setPagina(1)
                  }}
                  placeholder="Buscar por nombre"
                />
                <FilterDropdown
                  label="Estado"
                  options={OPCIONES_ESTADO}
                  value={estado}
                  onChange={(valor) => {
                    if (!esEstadoReglaFiltro(valor)) return
                    setEstado(valor)
                    setPagina(1)
                  }}
                  active={estado !== FILTRO_TODOS}
                />
                <FilterDropdown
                  label="Evento"
                  options={[
                    { value: FILTRO_TODOS, label: 'Todos' },
                    ...tiposEvento.map((tipo) => ({
                      value: tipo.id,
                      label: etiquetaEvento(tipo.nombre),
                    })),
                  ]}
                  value={tipoEventoId}
                  onChange={(valor) => {
                    setTipoEventoId(valor)
                    setPagina(1)
                  }}
                  active={tipoEventoId !== FILTRO_TODOS}
                />
                <FilterBarSpacer />
              </FilterBar>
              {vista === 'tarjetas' &&
                (cargando ? (
                  <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3" aria-busy="true">
                    {[0, 1, 2].map((indice) => (
                      <Skeleton key={indice} className="h-56 rounded-card-sm" />
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {deLaPagina.map((regla) => (
                      <TarjetaRegla
                        key={regla.id}
                        regla={regla}
                        tiposEvento={tiposEvento}
                        resumen={resumenPorRegla.get(regla.id)}
                        puedeActualizar={puedeActualizar}
                        puedeCrear={puedeCrear}
                        onCambiarActivo={cambiarActivo}
                        onDuplicar={duplicar}
                      />
                    ))}
                  </div>
                ))}
              {vista === 'tabla' && (
                <ReglasWorkflowTabla
                  reglas={deLaPagina}
                  tiposEvento={tiposEvento}
                  cargando={cargando}
                  puedeActualizar={puedeActualizar}
                  onCambiarActivo={cambiarActivo}
                  puedeCrear={puedeCrear}
                  onDuplicar={duplicar}
                />
              )}
              {vista === 'mapa' && (
                <MapaAutomatizaciones
                  tiposEvento={tiposEvento}
                  reglas={visibles}
                  resumenPorRegla={resumenPorRegla}
                  puedeCrear={puedeCrear}
                />
              )}
              {vista !== 'mapa' && !cargando && visibles.length === 0 && (
                <p className="text-center text-sm text-texto-2">
                  Ninguna regla coincide con los filtros.
                </p>
              )}
              {vista !== 'mapa' && !cargando && paginador}
            </div>
          </Tabs>
        )
      )}
      <EjecucionDetalleSheet
        ejecucion={detalle}
        onCerrar={() => setDetalle(null)}
        puedeActualizar={puedeActualizar}
        decidiendoId={decisiones.decidiendoId}
        onAprobar={decisiones.aprobar}
        onRechazar={decisiones.setPorRechazar}
      />
      <RechazoEjecucionDialog
        ejecucion={decisiones.porRechazar}
        enviando={decisiones.decidiendoId !== null}
        onConfirmar={(motivo) => void decisiones.rechazar(motivo)}
        onCancelar={() => decisiones.setPorRechazar(null)}
      />
    </div>
  )
}
