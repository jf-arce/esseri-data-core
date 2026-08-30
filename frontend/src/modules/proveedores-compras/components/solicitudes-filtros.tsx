import { ArrowDownAZIcon } from 'lucide-react'
import { DensityToggle, FilterBar, FilterBarSpacer, FilterSearch } from '@/components/filter-bar'
import { FilterChip, FilterChips, FilterDropdown } from '@/components/filter-dropdown'
import type { EstadoSolicitud, OrdenSolicitudes } from '@/modules/proveedores-compras/types'

const OPCIONES_ORDEN: { value: OrdenSolicitudes; label: string }[] = [
  { value: 'fecha-desc', label: 'Más recientes primero' },
  { value: 'fecha-asc', label: 'Más antiguas primero' },
  { value: 'cantidad-desc', label: 'Mayor cantidad' },
]

const OPCIONES_ESTADO: { value: EstadoSolicitud; label: string }[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'aprobada', label: 'Aprobada' },
  { value: 'rechazada', label: 'Rechazada' },
]

interface SolicitudesFiltrosProps {
  busqueda: string
  onBusquedaChange: (valor: string) => void
  estado: '' | EstadoSolicitud
  onEstadoChange: (valor: '' | EstadoSolicitud) => void
  orden: OrdenSolicitudes
  onOrdenChange: (valor: OrdenSolicitudes) => void
  densidad: 'comfortable' | 'compact'
  onDensidadChange: (valor: 'comfortable' | 'compact') => void
  hayFiltrosActivos: boolean
}

function SolicitudesFiltros({
  busqueda,
  onBusquedaChange,
  estado,
  onEstadoChange,
  orden,
  onOrdenChange,
  densidad,
  onDensidadChange,
  hayFiltrosActivos,
}: SolicitudesFiltrosProps) {
  return (
    <div className="flex flex-col gap-3">
      <FilterBar>
        <FilterSearch
          value={busqueda}
          onChange={onBusquedaChange}
          placeholder="Buscar por artículo o área"
        />

        <FilterDropdown
          label="Estado"
          options={OPCIONES_ESTADO}
          value={estado}
          onChange={(valor) => onEstadoChange(valor as '' | EstadoSolicitud)}
        />

        <FilterBarSpacer />

        <FilterDropdown
          label={OPCIONES_ORDEN.find((o) => o.value === orden)?.label ?? 'Ordenar por'}
          icon={ArrowDownAZIcon}
          align="end"
          options={OPCIONES_ORDEN}
          value={orden}
          onChange={(valor) => onOrdenChange(valor as OrdenSolicitudes)}
        />

        <DensityToggle value={densidad} onChange={onDensidadChange} />
      </FilterBar>

      {hayFiltrosActivos && (
        <FilterChips
          onClearAll={() => {
            onBusquedaChange('')
            onEstadoChange('')
          }}
        >
          {busqueda.trim() !== '' && (
            <FilterChip onRemove={() => onBusquedaChange('')}>Búsqueda: {busqueda}</FilterChip>
          )}
          {estado !== '' && (
            <FilterChip onRemove={() => onEstadoChange('')}>
              Estado: {OPCIONES_ESTADO.find((o) => o.value === estado)?.label}
            </FilterChip>
          )}
        </FilterChips>
      )}
    </div>
  )
}

export { SolicitudesFiltros }
