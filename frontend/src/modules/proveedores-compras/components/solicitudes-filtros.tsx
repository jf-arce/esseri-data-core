import { ArrowDownAZIcon } from 'lucide-react'
import { DatePicker } from '@/components/date-picker'
import { FilterBar, FilterBarSpacer, FilterSearch } from '@/components/filter-bar'
import { FilterChip, FilterChips, FilterDropdown } from '@/components/filter-dropdown'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type {
  AreaSolicitante,
  EstadoSolicitud,
  FiltrosSolicitudes,
  OrdenSolicitudes,
} from '@/modules/proveedores-compras/types'
import {
  CANTIDAD_MAXIMA_SOLICITUD,
  FILTROS_SOLICITUDES_VACIOS,
  fechaAISO,
  formatearFechaDia,
  hayFiltrosSolicitudes,
  parsearFechaISO,
} from '@/modules/proveedores-compras/utils'

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
  filtros: FiltrosSolicitudes
  onCambios: (cambios: Partial<FiltrosSolicitudes>) => void
  areas: AreaSolicitante[]
  solicitantes: string[]
  orden: OrdenSolicitudes
  onOrdenChange: (valor: OrdenSolicitudes) => void
}

function SolicitudesFiltros({
  filtros,
  onCambios,
  areas,
  solicitantes,
  orden,
  onOrdenChange,
}: SolicitudesFiltrosProps) {
  const { busqueda, estado, areaId, solicitante, desde, hasta, cantidadMin, cantidadMax } = filtros

  const etiquetaArea = areas.find((area) => area.id === areaId)?.nombre
  const rangoCantidad =
    cantidadMin !== '' && cantidadMax !== ''
      ? `${cantidadMin} a ${cantidadMax}`
      : cantidadMin !== ''
        ? `desde ${cantidadMin}`
        : `hasta ${cantidadMax}`

  return (
    <div className="flex flex-col gap-3">
      <FilterBar>
        <FilterSearch
          value={busqueda}
          onChange={(valor) => onCambios({ busqueda: valor })}
          placeholder="Buscar por artículo, área o solicitante"
        />

        <FilterDropdown
          label="Estado"
          options={OPCIONES_ESTADO}
          value={estado}
          active={estado !== ''}
          onChange={(valor) => onCambios({ estado: valor as '' | EstadoSolicitud })}
        />

        <FilterDropdown
          label="Área"
          options={areas.map((area) => ({
            value: area.id,
            label: area.activo ? area.nombre : `${area.nombre} (inactiva)`,
          }))}
          value={areaId}
          active={areaId !== ''}
          onChange={(valor) => onCambios({ areaId: valor })}
        />

        <FilterDropdown
          label="Solicitante"
          options={solicitantes.map((nombre) => ({ value: nombre, label: nombre }))}
          value={solicitante}
          active={solicitante !== ''}
          onChange={(valor) => onCambios({ solicitante: valor })}
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
      </FilterBar>

      <div className="flex flex-wrap items-end gap-3">
        <Field className="w-44">
          <FieldLabel htmlFor="solicitudes-desde">Fecha desde</FieldLabel>
          <DatePicker
            id="solicitudes-desde"
            value={desde ? parsearFechaISO(desde) : undefined}
            onChange={(fecha) => onCambios({ desde: fecha ? fechaAISO(fecha) : '' })}
            placeholder="dd/mm/aaaa"
          />
        </Field>
        <Field className="w-44">
          <FieldLabel htmlFor="solicitudes-hasta">Fecha hasta</FieldLabel>
          <DatePicker
            id="solicitudes-hasta"
            value={hasta ? parsearFechaISO(hasta) : undefined}
            onChange={(fecha) => onCambios({ hasta: fecha ? fechaAISO(fecha) : '' })}
            placeholder="dd/mm/aaaa"
          />
        </Field>
        <Field className="w-32">
          <FieldLabel htmlFor="solicitudes-cantidad-min">Cantidad mín.</FieldLabel>
          <Input
            id="solicitudes-cantidad-min"
            type="number"
            min={1}
            max={CANTIDAD_MAXIMA_SOLICITUD}
            value={cantidadMin}
            onChange={(evento) => onCambios({ cantidadMin: evento.target.value })}
            placeholder="1"
          />
        </Field>
        <Field className="w-32">
          <FieldLabel htmlFor="solicitudes-cantidad-max">Cantidad máx.</FieldLabel>
          <Input
            id="solicitudes-cantidad-max"
            type="number"
            min={1}
            max={CANTIDAD_MAXIMA_SOLICITUD}
            value={cantidadMax}
            onChange={(evento) => onCambios({ cantidadMax: evento.target.value })}
            placeholder={String(CANTIDAD_MAXIMA_SOLICITUD)}
          />
        </Field>
      </div>

      {hayFiltrosSolicitudes(filtros) && (
        <FilterChips onClearAll={() => onCambios({ ...FILTROS_SOLICITUDES_VACIOS })}>
          {busqueda.trim() !== '' && (
            <FilterChip onRemove={() => onCambios({ busqueda: '' })}>Búsqueda: {busqueda}</FilterChip>
          )}
          {estado !== '' && (
            <FilterChip onRemove={() => onCambios({ estado: '' })}>
              Estado: {OPCIONES_ESTADO.find((o) => o.value === estado)?.label}
            </FilterChip>
          )}
          {areaId !== '' && (
            <FilterChip onRemove={() => onCambios({ areaId: '' })}>
              Área: {etiquetaArea ?? '—'}
            </FilterChip>
          )}
          {solicitante !== '' && (
            <FilterChip onRemove={() => onCambios({ solicitante: '' })}>
              Solicitante: {solicitante}
            </FilterChip>
          )}
          {desde !== '' && (
            <FilterChip onRemove={() => onCambios({ desde: '' })}>
              Desde: {formatearFechaDia(desde)}
            </FilterChip>
          )}
          {hasta !== '' && (
            <FilterChip onRemove={() => onCambios({ hasta: '' })}>
              Hasta: {formatearFechaDia(hasta)}
            </FilterChip>
          )}
          {(cantidadMin !== '' || cantidadMax !== '') && (
            <FilterChip onRemove={() => onCambios({ cantidadMin: '', cantidadMax: '' })}>
              Cantidad: {rangoCantidad}
            </FilterChip>
          )}
        </FilterChips>
      )}
    </div>
  )
}

export { SolicitudesFiltros }
