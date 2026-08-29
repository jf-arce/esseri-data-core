import { ArrowDownAZIcon } from 'lucide-react'
import { DensityToggle, FilterBar, FilterBarSpacer, FilterSearch } from '@/components/filter-bar'
import { FilterChip, FilterChips, FilterDropdown } from '@/components/filter-dropdown'
import type { EstadoProveedor, OrdenProveedores } from '@/modules/proveedores-compras/types'

const OPCIONES_ORDEN: { value: OrdenProveedores; label: string }[] = [
  { value: 'nombre-asc', label: 'Nombre, A-Z' },
  { value: 'nombre-desc', label: 'Nombre, Z-A' },
  { value: 'categoria-asc', label: 'Categoría, A-Z' },
]

const OPCIONES_ESTADO: { value: EstadoProveedor; label: string }[] = [
  { value: 'activo', label: 'Activo' },
  { value: 'inactivo', label: 'Inactivo' },
]

interface ProveedoresFiltrosProps {
  busqueda: string
  onBusquedaChange: (valor: string) => void
  categoriasFiltro: string[]
  onCategoriasFiltroChange: (valor: string[]) => void
  categoriasDisponibles: string[]
  estado: '' | EstadoProveedor
  onEstadoChange: (valor: '' | EstadoProveedor) => void
  orden: OrdenProveedores
  onOrdenChange: (valor: OrdenProveedores) => void
  densidad: 'comfortable' | 'compact'
  onDensidadChange: (valor: 'comfortable' | 'compact') => void
  hayFiltrosActivos: boolean
}

function ProveedoresFiltros({
  busqueda,
  onBusquedaChange,
  categoriasFiltro,
  onCategoriasFiltroChange,
  categoriasDisponibles,
  estado,
  onEstadoChange,
  orden,
  onOrdenChange,
  densidad,
  onDensidadChange,
  hayFiltrosActivos,
}: ProveedoresFiltrosProps) {
  return (
    <div className="flex flex-col gap-3">
      <FilterBar>
        <FilterSearch value={busqueda} onChange={onBusquedaChange} placeholder="Buscar proveedor" />

        <FilterDropdown
          label="Estado"
          options={OPCIONES_ESTADO}
          value={estado}
          onChange={(valor) => onEstadoChange(valor as '' | EstadoProveedor)}
        />

        {categoriasDisponibles.length > 0 && (
          <FilterDropdown
            multiple
            label="Categoría"
            options={categoriasDisponibles.map((categoria) => ({
              value: categoria,
              label: categoria,
            }))}
            value={categoriasFiltro}
            onChange={onCategoriasFiltroChange}
          />
        )}

        <FilterBarSpacer />

        <FilterDropdown
          label={OPCIONES_ORDEN.find((o) => o.value === orden)?.label ?? 'Ordenar por'}
          icon={ArrowDownAZIcon}
          align="end"
          options={OPCIONES_ORDEN}
          value={orden}
          onChange={(valor) => onOrdenChange(valor as OrdenProveedores)}
        />

        <DensityToggle value={densidad} onChange={onDensidadChange} />
      </FilterBar>

      {hayFiltrosActivos && (
        <FilterChips
          onClearAll={() => {
            onBusquedaChange('')
            onCategoriasFiltroChange([])
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
          {categoriasFiltro.map((categoria) => (
            <FilterChip
              key={categoria}
              onRemove={() =>
                onCategoriasFiltroChange(categoriasFiltro.filter((c) => c !== categoria))
              }
            >
              Categoría: {categoria}
            </FilterChip>
          ))}
        </FilterChips>
      )}
    </div>
  )
}

export { ProveedoresFiltros }
