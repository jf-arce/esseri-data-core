import { ArrowDownUpIcon, DownloadIcon } from 'lucide-react'
import { FilterBar, FilterBarSpacer, FilterSearch } from '@/components/filter-bar'
import { FilterChip, FilterChips, FilterDropdown } from '@/components/filter-dropdown'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { EstadoInscripcion, TipoInscripcion } from '@/modules/inscripciones/types'
import { etiquetaEstadoInscripcion, etiquetaTipoInscripcion } from '@/modules/inscripciones/utils'

const OPCIONES_TIPO = [
  { value: 'todos', label: 'Todos' },
  { value: 'nueva', label: 'Nueva' },
  { value: 'reinscripcion', label: 'Reinscripción' },
  { value: 'cambio_matricula', label: 'Cambio de matrícula' },
  { value: 'baja', label: 'Baja' },
]

const OPCIONES_ESTADO = [
  { value: 'todos', label: 'Todos' },
  { value: 'activa', label: 'Activa' },
  { value: 'finalizada', label: 'Finalizada' },
  { value: 'baja', label: 'Baja' },
]

const OPCIONES_ORDEN = [
  { value: 'fecha_desc', label: 'Fecha más reciente' },
  { value: 'fecha_asc', label: 'Fecha más antigua' },
  { value: 'alumno_asc', label: 'Alumno, A-Z' },
]

interface InscripcionesFiltrosProps {
  busqueda: string
  onBusquedaChange: (valor: string) => void
  tipo: TipoInscripcion | ''
  onTipoChange: (valor: TipoInscripcion | '') => void
  estado: EstadoInscripcion | ''
  onEstadoChange: (valor: EstadoInscripcion | '') => void
  orden: 'fecha_desc' | 'fecha_asc' | 'alumno_asc'
  onOrdenChange: (valor: 'fecha_desc' | 'fecha_asc' | 'alumno_asc') => void
  onExportar: () => void
  exportando: boolean
}

export function InscripcionesFiltros({
  busqueda,
  onBusquedaChange,
  tipo,
  onTipoChange,
  estado,
  onEstadoChange,
  orden,
  onOrdenChange,
  onExportar,
  exportando,
}: InscripcionesFiltrosProps) {
  const hayFiltros = busqueda.trim() !== '' || tipo !== '' || estado !== ''

  const limpiar = () => {
    onBusquedaChange('')
    onTipoChange('')
    onEstadoChange('')
  }

  return (
    <div className="flex flex-col gap-3">
      <FilterBar>
        <FilterSearch
          value={busqueda}
          onChange={onBusquedaChange}
          placeholder="Buscar por alumno o legajo"
        />
        <FilterDropdown
          label="Tipo"
          options={OPCIONES_TIPO}
          value={tipo || 'todos'}
          onChange={(valor) => onTipoChange(valor === 'todos' ? '' : (valor as TipoInscripcion))}
          active={tipo !== ''}
        />
        <FilterDropdown
          label="Estado"
          options={OPCIONES_ESTADO}
          value={estado || 'todos'}
          onChange={(valor) =>
            onEstadoChange(valor === 'todos' ? '' : (valor as EstadoInscripcion))
          }
          active={estado !== ''}
        />
        <FilterBarSpacer />
        <FilterDropdown
          label={OPCIONES_ORDEN.find((opcion) => opcion.value === orden)?.label ?? 'Ordenar'}
          options={OPCIONES_ORDEN}
          value={orden}
          onChange={(valor) => onOrdenChange(valor as typeof orden)}
          icon={ArrowDownUpIcon}
          align="end"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label="Descargar inscripciones en CSV"
              disabled={exportando}
              onClick={onExportar}
            >
              <DownloadIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{exportando ? 'Preparando CSV…' : 'Descargar CSV'}</TooltipContent>
        </Tooltip>
      </FilterBar>

      {hayFiltros && (
        <FilterChips onClearAll={limpiar}>
          {busqueda.trim() !== '' && (
            <FilterChip onRemove={() => onBusquedaChange('')}>Búsqueda: {busqueda}</FilterChip>
          )}
          {tipo !== '' && (
            <FilterChip onRemove={() => onTipoChange('')}>
              Tipo: {etiquetaTipoInscripcion(tipo)}
            </FilterChip>
          )}
          {estado !== '' && (
            <FilterChip onRemove={() => onEstadoChange('')}>
              Estado: {etiquetaEstadoInscripcion(estado)}
            </FilterChip>
          )}
        </FilterChips>
      )}
    </div>
  )
}
