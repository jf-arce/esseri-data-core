import { useState } from 'react'
import { Link } from 'react-router'
import {
  CircleCheckIcon,
  CirclePauseIcon,
  PlusIcon,
  ShieldAlertIcon,
  WorkflowIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { FilterBar, FilterBarSpacer, FilterSearch } from '@/components/filter-bar'
import { FilterDropdown } from '@/components/filter-dropdown'
import { PageHeader } from '@/components/page-header'
import { StatTile } from '@/components/stat-tile'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import {
  PERMISO_WORKFLOWS_ACTUALIZAR,
  PERMISO_WORKFLOWS_CREAR,
  tienePermiso,
} from '@/modules/auth/constants'
import { ReglasWorkflowTabla } from '@/modules/workflows/components/reglas-workflow-tabla'
import { useCatalogosWorkflow } from '@/modules/workflows/hooks/use-catalogos-workflow'
import { useReglasWorkflow } from '@/modules/workflows/hooks/use-reglas-workflow'
import { actualizarReglaWorkflow } from '@/modules/workflows/services/actualizar-regla-workflow'
import type { ReglaWorkflow } from '@/modules/workflows/types'
import {
  esEstadoReglaFiltro,
  filtrarReglas,
  type EstadoReglaFiltro,
} from '@/modules/workflows/utils'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

const OPCIONES_ESTADO: { value: EstadoReglaFiltro; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'activas', label: 'Activas' },
  { value: 'inactivas', label: 'Inactivas' },
]

export function ReglasWorkflowPage() {
  const permisos = useAuthStore(permisosActivos)
  const puedeCrear = tienePermiso(permisos, PERMISO_WORKFLOWS_CREAR)
  const puedeActualizar = tienePermiso(permisos, PERMISO_WORKFLOWS_ACTUALIZAR)
  const { reglas, cargando, error, sinPermiso, recargar } = useReglasWorkflow()
  const { tiposEvento } = useCatalogosWorkflow()
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<EstadoReglaFiltro>('todos')
  const [tipoEventoId, setTipoEventoId] = useState('todos')

  async function cambiarActivo(regla: ReglaWorkflow) {
    try {
      await actualizarReglaWorkflow(regla.id, { activo: !regla.activo })
      toast.success(regla.activo ? 'Regla desactivada' : 'Regla activada')
      recargar()
    } catch (causa) {
      toast.error(causa instanceof ApiError ? causa.detail : 'No se pudo actualizar la regla.')
    }
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

  const activas = reglas.filter((regla) => regla.activo).length
  const visibles = filtrarReglas(reglas, { busqueda, estado, tipoEventoId })
  const sinReglas = !cargando && !error && reglas.length === 0
  const nuevaRegla = puedeCrear && (
    <Button asChild>
      <Link to="/workflows/reglas/nueva">
        <PlusIcon data-icon="inline-start" />
        Nueva regla
      </Link>
    </Button>
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader titulo="Reglas de automatización" accion={nuevaRegla} />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile
          label="Reglas activas"
          value={activas}
          icon={CircleCheckIcon}
          cargando={cargando}
        />
        <StatTile
          label="Reglas inactivas"
          value={reglas.length - activas}
          icon={CirclePauseIcon}
          cargando={cargando}
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
            Una regla dispara una acción cuando ocurre un evento y se cumple su condición.
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
                active={estado !== 'todos'}
              />
              <FilterDropdown
                label="Evento"
                options={[
                  { value: 'todos', label: 'Todos' },
                  ...tiposEvento.map((tipo) => ({ value: tipo.id, label: tipo.nombre })),
                ]}
                value={tipoEventoId}
                onChange={setTipoEventoId}
                active={tipoEventoId !== 'todos'}
              />
              <FilterBarSpacer />
            </FilterBar>
            <ReglasWorkflowTabla
              reglas={visibles}
              tiposEvento={tiposEvento}
              cargando={cargando}
              puedeActualizar={puedeActualizar}
              onCambiarActivo={cambiarActivo}
            />
            {!cargando && visibles.length === 0 && (
              <p className="text-center text-sm text-texto-2">
                Ninguna regla coincide con los filtros.
              </p>
            )}
          </>
        )
      )}
    </div>
  )
}
