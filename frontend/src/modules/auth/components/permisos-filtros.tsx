import { ArrowDownAZIcon } from 'lucide-react'
import { DensityToggle, FilterBar, FilterBarSpacer, FilterSearch } from '@/components/filter-bar'
import { FilterChip, FilterChips, FilterDropdown } from '@/components/filter-dropdown'
import type { OrdenPermisos } from '@/modules/auth/utils'

const OPCIONES_ORDEN: { value: OrdenPermisos; label: string }[] = [
  { value: 'modulo-asc', label: 'Módulo, A-Z' },
  { value: 'accion-asc', label: 'Acción, A-Z' },
]

interface PermisosFiltrosProps {
  busqueda: string
  onBusquedaChange: (valor: string) => void
  modulosFiltro: string[]
  onModulosFiltroChange: (valor: string[]) => void
  modulosDisponibles: string[]
  orden: OrdenPermisos
  onOrdenChange: (valor: OrdenPermisos) => void
  densidad: 'comfortable' | 'compact'
  onDensidadChange: (valor: 'comfortable' | 'compact') => void
  hayFiltrosActivos: boolean
}

function PermisosFiltros({
  busqueda,
  onBusquedaChange,
  modulosFiltro,
  onModulosFiltroChange,
  modulosDisponibles,
  orden,
  onOrdenChange,
  densidad,
  onDensidadChange,
  hayFiltrosActivos,
}: PermisosFiltrosProps) {
  return (
    <div className="flex flex-col gap-3">
      <FilterBar>
        <FilterSearch value={busqueda} onChange={onBusquedaChange} placeholder="Buscar permiso" />

        <FilterDropdown
          multiple
          label="Módulo"
          options={modulosDisponibles.map((modulo) => ({ value: modulo, label: modulo }))}
          value={modulosFiltro}
          onChange={onModulosFiltroChange}
        />

        <FilterBarSpacer />

        <FilterDropdown
          label={OPCIONES_ORDEN.find((o) => o.value === orden)?.label ?? 'Ordenar por'}
          icon={ArrowDownAZIcon}
          align="end"
          options={OPCIONES_ORDEN}
          value={orden}
          onChange={(valor) => onOrdenChange(valor as OrdenPermisos)}
        />

        <DensityToggle value={densidad} onChange={onDensidadChange} />
      </FilterBar>

      {hayFiltrosActivos && (
        <FilterChips
          onClearAll={() => {
            onBusquedaChange('')
            onModulosFiltroChange([])
          }}
        >
          {busqueda.trim() !== '' && (
            <FilterChip onRemove={() => onBusquedaChange('')}>Búsqueda: {busqueda}</FilterChip>
          )}
          {modulosFiltro.map((modulo) => (
            <FilterChip
              key={modulo}
              onRemove={() => onModulosFiltroChange(modulosFiltro.filter((m) => m !== modulo))}
            >
              Módulo: {modulo}
            </FilterChip>
          ))}
        </FilterChips>
      )}
    </div>
  )
}

export { PermisosFiltros }
