import { ArrowDownAZIcon } from 'lucide-react'
import { DensityToggle, FilterBar, FilterBarSpacer, FilterSearch } from '@/components/filter-bar'
import { FilterChip, FilterChips, FilterDropdown } from '@/components/filter-dropdown'
import type { OrdenProductos, TipoProductoServicio } from '@/modules/proveedores-compras/types'

const OPCIONES_ORDEN: { value: OrdenProductos; label: string }[] = [
  { value: 'nombre-asc', label: 'Nombre, A-Z' },
  { value: 'nombre-desc', label: 'Nombre, Z-A' },
  { value: 'categoria-asc', label: 'Categoría, A-Z' },
]

const OPCIONES_TIPO: { value: TipoProductoServicio; label: string }[] = [
  { value: 'producto', label: 'Producto' },
  { value: 'servicio', label: 'Servicio' },
]

const OPCIONES_DISPONIBILIDAD: { value: string; label: string }[] = [
  { value: 'activos', label: 'Solo activos' },
  { value: 'todos', label: 'Activos e inactivos' },
]

interface ProductosFiltrosProps {
  busqueda: string
  onBusquedaChange: (valor: string) => void
  categoriasFiltro: string[]
  onCategoriasFiltroChange: (valor: string[]) => void
  categoriasDisponibles: string[]
  tipo: '' | TipoProductoServicio
  onTipoChange: (valor: '' | TipoProductoServicio) => void
  soloActivos: boolean
  onSoloActivosChange: (valor: boolean) => void
  orden: OrdenProductos
  onOrdenChange: (valor: OrdenProductos) => void
  densidad: 'comfortable' | 'compact'
  onDensidadChange: (valor: 'comfortable' | 'compact') => void
  hayFiltrosActivos: boolean
}

function ProductosFiltros({
  busqueda,
  onBusquedaChange,
  categoriasFiltro,
  onCategoriasFiltroChange,
  categoriasDisponibles,
  tipo,
  onTipoChange,
  soloActivos,
  onSoloActivosChange,
  orden,
  onOrdenChange,
  densidad,
  onDensidadChange,
  hayFiltrosActivos,
}: ProductosFiltrosProps) {
  return (
    <div className="flex flex-col gap-3">
      <FilterBar>
        <FilterSearch
          value={busqueda}
          onChange={onBusquedaChange}
          placeholder="Buscar en el catálogo"
        />

        <FilterDropdown
          label="Tipo"
          options={OPCIONES_TIPO}
          value={tipo}
          onChange={(valor) => onTipoChange(valor as '' | TipoProductoServicio)}
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

        {/* Por defecto se ven solo los activos: quien arma una compra no debería toparse con
            ítems dados de baja. Administrar el catálogo (reactivar algo) es el caso menos
            frecuente, así que va detrás de este filtro. */}
        <FilterDropdown
          label="Disponibilidad"
          options={OPCIONES_DISPONIBILIDAD}
          value={soloActivos ? 'activos' : 'todos'}
          onChange={(valor) => onSoloActivosChange(valor !== 'todos')}
        />

        <FilterBarSpacer />

        <FilterDropdown
          label={OPCIONES_ORDEN.find((o) => o.value === orden)?.label ?? 'Ordenar por'}
          icon={ArrowDownAZIcon}
          align="end"
          options={OPCIONES_ORDEN}
          value={orden}
          onChange={(valor) => onOrdenChange(valor as OrdenProductos)}
        />

        <DensityToggle value={densidad} onChange={onDensidadChange} />
      </FilterBar>

      {hayFiltrosActivos && (
        <FilterChips
          onClearAll={() => {
            onBusquedaChange('')
            onCategoriasFiltroChange([])
            onTipoChange('')
            onSoloActivosChange(true)
          }}
        >
          {busqueda.trim() !== '' && (
            <FilterChip onRemove={() => onBusquedaChange('')}>Búsqueda: {busqueda}</FilterChip>
          )}
          {tipo !== '' && (
            <FilterChip onRemove={() => onTipoChange('')}>
              Tipo: {OPCIONES_TIPO.find((o) => o.value === tipo)?.label}
            </FilterChip>
          )}
          {!soloActivos && (
            <FilterChip onRemove={() => onSoloActivosChange(true)}>Incluye inactivos</FilterChip>
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

export { ProductosFiltros }
