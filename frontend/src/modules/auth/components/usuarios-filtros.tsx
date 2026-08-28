import { ArrowDownAZIcon } from 'lucide-react'
import { DensityToggle, FilterBar, FilterBarSpacer, FilterSearch } from '@/components/filter-bar'
import { FilterChip, FilterChips, FilterDropdown } from '@/components/filter-dropdown'
import type { Rol } from '@/modules/auth/types'
import type { EstadoUsuarioFiltro, OrdenUsuarios } from '@/modules/auth/utils'

const OPCIONES_ESTADO: { value: EstadoUsuarioFiltro; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'activo', label: 'Activos' },
  { value: 'inactivo', label: 'Inactivos' },
]

const OPCIONES_ORDEN: { value: OrdenUsuarios; label: string }[] = [
  { value: 'nombre-asc', label: 'Nombre, A-Z' },
  { value: 'nombre-desc', label: 'Nombre, Z-A' },
  { value: 'acceso-reciente', label: 'Último acceso reciente' },
  { value: 'acceso-antiguo', label: 'Último acceso antiguo' },
]

interface UsuariosFiltrosProps {
  busqueda: string
  onBusquedaChange: (valor: string) => void
  estado: EstadoUsuarioFiltro
  onEstadoChange: (valor: EstadoUsuarioFiltro) => void
  rolesFiltro: string[]
  onRolesFiltroChange: (valor: string[]) => void
  orden: OrdenUsuarios
  onOrdenChange: (valor: OrdenUsuarios) => void
  densidad: 'comfortable' | 'compact'
  onDensidadChange: (valor: 'comfortable' | 'compact') => void
  roles: Rol[]
  hayFiltrosActivos: boolean
}

function UsuariosFiltros({
  busqueda,
  onBusquedaChange,
  estado,
  onEstadoChange,
  rolesFiltro,
  onRolesFiltroChange,
  orden,
  onOrdenChange,
  densidad,
  onDensidadChange,
  roles,
  hayFiltrosActivos,
}: UsuariosFiltrosProps) {
  return (
    <div className="flex flex-col gap-3">
      <FilterBar>
        <FilterSearch value={busqueda} onChange={onBusquedaChange} placeholder="Buscar usuario" />

        <FilterDropdown
          label="Estado"
          options={OPCIONES_ESTADO}
          value={estado}
          onChange={(valor) => onEstadoChange(valor as EstadoUsuarioFiltro)}
          active={estado !== 'todos'}
        />

        <FilterDropdown
          multiple
          label="Rol"
          options={roles.map((rol) => ({ value: rol.id, label: rol.nombre }))}
          value={rolesFiltro}
          onChange={onRolesFiltroChange}
        />

        <FilterBarSpacer />

        <FilterDropdown
          label={OPCIONES_ORDEN.find((o) => o.value === orden)?.label ?? 'Ordenar por'}
          icon={ArrowDownAZIcon}
          align="end"
          options={OPCIONES_ORDEN}
          value={orden}
          onChange={(valor) => onOrdenChange(valor as OrdenUsuarios)}
        />

        <DensityToggle value={densidad} onChange={onDensidadChange} />
      </FilterBar>

      {hayFiltrosActivos && (
        <FilterChips
          onClearAll={() => {
            onBusquedaChange('')
            onEstadoChange('todos')
            onRolesFiltroChange([])
          }}
        >
          {busqueda.trim() !== '' && (
            <FilterChip onRemove={() => onBusquedaChange('')}>Búsqueda: {busqueda}</FilterChip>
          )}
          {estado !== 'todos' && (
            <FilterChip onRemove={() => onEstadoChange('todos')}>
              Estado: {OPCIONES_ESTADO.find((o) => o.value === estado)?.label}
            </FilterChip>
          )}
          {rolesFiltro.map((rolId) => {
            const rol = roles.find((r) => r.id === rolId)
            if (!rol) return null
            return (
              <FilterChip
                key={rolId}
                onRemove={() => onRolesFiltroChange(rolesFiltro.filter((id) => id !== rolId))}
              >
                Rol: {rol.nombre}
              </FilterChip>
            )
          })}
        </FilterChips>
      )}
    </div>
  )
}

export { UsuariosFiltros }
