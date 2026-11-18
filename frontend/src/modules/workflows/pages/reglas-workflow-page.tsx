import { lazy, Suspense, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  LayoutGridIcon,
  MapIcon,
  PlusIcon,
  ShieldAlertIcon,
  TableIcon,
  WorkflowIcon,
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  PERMISO_WORKFLOWS_ACTUALIZAR,
  PERMISO_WORKFLOWS_CREAR,
  tienePermiso,
} from '@/modules/auth/constants'
import { ActividadEnVivo } from '@/modules/workflows/components/actividad-en-vivo'
import { AtencionWorkflows } from '@/modules/workflows/components/atencion-workflows'
import { EjecucionDetalleSheet } from '@/modules/workflows/components/ejecucion-detalle-sheet'
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
  VISTAS_REGLAS,
} from '@/modules/workflows/constants'
import { useActividadWorkflows } from '@/modules/workflows/hooks/use-actividad-workflows'
import { useCatalogosWorkflow } from '@/modules/workflows/hooks/use-catalogos-workflow'
import { useDecisionesEjecucion } from '@/modules/workflows/hooks/use-decisiones-ejecucion'
import { useEjecucionesWorkflow } from '@/modules/workflows/hooks/use-ejecuciones-workflow'
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

// El mapa carga @xyflow/react: comparte el chunk con el editor y no pesa en las otras vistas.
const MapaAutomatizaciones = lazy(
  () => import('@/modules/workflows/components/mapa-automatizaciones'),
)

type Vista = (typeof VISTAS_REGLAS)[number]

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
  const { reglas, cargando, error, sinPermiso, recargar } = useReglasWorkflow()
  const { tiposEvento } = useCatalogosWorkflow()
  const resumen = useResumenWorkflows()
  const actividad = useActividadWorkflows()
  const pendientes = useEjecucionesWorkflow({ estado: 'pendiente', pagina: 1, tamanioPagina: 5 })
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<EstadoReglaFiltro>(FILTRO_TODOS)
  const [tipoEventoId, setTipoEventoId] = useState(FILTRO_TODOS)
  const [vista, setVista] = useState<Vista>(leerVista)
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
    try {
      await actualizarReglaWorkflow(regla.id, { activo: !regla.activo })
      toast.success(regla.activo ? 'Regla desactivada' : 'Regla activada')
      recargar()
      resumen.recargar()
    } catch (causa) {
      toast.error(causa instanceof ApiError ? causa.detail : 'No se pudo actualizar la regla.')
    }
  }

  function duplicar(regla: ReglaWorkflow) {
    navigate(`${RUTA_NUEVA_REGLA}?duplicar=${regla.id}`)
  }

  function elegirVista(valor: string) {
    if (!esVista(valor)) return
    setVista(valor)
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
          <>
            <FilterBar>
              <FilterSearch
                value={busqueda}
                onChange={setBusqueda}
                placeholder="Buscar por nombre"
              />
              <FilterDropdown
                label="Estado"
                options={OPCIONES_ESTADO}
                value={estado}
                onChange={(valor) => {
                  if (esEstadoReglaFiltro(valor)) setEstado(valor)
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
                onChange={setTipoEventoId}
                active={tipoEventoId !== FILTRO_TODOS}
              />
              <FilterBarSpacer />
              <ToggleGroup
                type="single"
                value={vista}
                onValueChange={elegirVista}
                aria-label="Vista de las reglas"
                variant="outline"
                spacing={0}
              >
                <ToggleGroupItem value="tarjetas" aria-label="Tarjetas">
                  <LayoutGridIcon />
                </ToggleGroupItem>
                <ToggleGroupItem value="tabla" aria-label="Tabla">
                  <TableIcon />
                </ToggleGroupItem>
                <ToggleGroupItem value="mapa" aria-label="Mapa de automatizaciones">
                  <MapIcon />
                </ToggleGroupItem>
              </ToggleGroup>
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
                  {visibles.map((regla) => (
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
                reglas={visibles}
                tiposEvento={tiposEvento}
                cargando={cargando}
                puedeActualizar={puedeActualizar}
                onCambiarActivo={cambiarActivo}
                puedeCrear={puedeCrear}
                onDuplicar={duplicar}
              />
            )}
            {vista === 'mapa' && (
              <Suspense fallback={<Skeleton className="h-[420px] rounded-panel" />}>
                <MapaAutomatizaciones
                  tiposEvento={tiposEvento}
                  reglas={visibles}
                  puedeCrear={puedeCrear}
                />
              </Suspense>
            )}
            {vista !== 'mapa' && !cargando && visibles.length === 0 && (
              <p className="text-center text-sm text-texto-2">
                Ninguna regla coincide con los filtros.
              </p>
            )}
          </>
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
