import { FilterBar, FilterBarSpacer } from '@/components/filter-bar'
import { FilterChip, FilterChips, FilterDropdown } from '@/components/filter-dropdown'
import type { EstadoFactura } from '@/modules/facturacion/types'
import { etiquetaEstadoFactura } from '@/modules/facturacion/utils'

const OPCIONES_ESTADO = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'vencida', label: 'Vencida' },
  { value: 'pagada', label: 'Pagada' },
]

interface FacturasFiltrosProps {
  estado: EstadoFactura | ''
  onEstadoChange: (estado: EstadoFactura | '') => void
}

export function FacturasFiltros({ estado, onEstadoChange }: FacturasFiltrosProps) {
  return (
    <div className="flex flex-col gap-3">
      <FilterBar>
        <FilterDropdown
          label="Estado"
          options={OPCIONES_ESTADO}
          value={estado || 'todos'}
          active={estado !== ''}
          onChange={(valor) => onEstadoChange(valor === 'todos' ? '' : (valor as EstadoFactura))}
        />
        <FilterBarSpacer />
      </FilterBar>
      {estado && (
        <FilterChips onClearAll={() => onEstadoChange('')}>
          <FilterChip onRemove={() => onEstadoChange('')}>
            Estado: {etiquetaEstadoFactura(estado)}
          </FilterChip>
        </FilterChips>
      )}
    </div>
  )
}
