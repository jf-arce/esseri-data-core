import { ArrowDownAZIcon } from 'lucide-react'
import { ComboboxBuscable, type OpcionCombo } from '@/components/combobox-buscable'
import { DatePicker } from '@/components/date-picker'
import { FilterBar, FilterBarSpacer, FilterSearch } from '@/components/filter-bar'
import {
  FilterChip,
  FilterChips,
  FilterDropdown,
  FilterTrigger,
} from '@/components/filter-dropdown'
import { FILTRO_TODOS } from '@/modules/auditoria/constants'
import type { FiltrosAuditoria, OpcionesAuditoria, OrdenAuditoria } from '@/modules/auditoria/types'
import {
  etiquetaEntidad,
  etiquetaUsuario,
  fechaAISO,
  formatearCampo,
  formatearFechaDia,
  hayFiltrosAuditoria,
  parsearFechaISO,
} from '@/modules/auditoria/utils'

const OPCIONES_ORDEN: { value: OrdenAuditoria; label: string }[] = [
  { value: 'fecha-desc', label: 'Más recientes primero' },
  { value: 'fecha-asc', label: 'Más antiguas primero' },
]

const OPCIONES_ACTOR = [
  { value: FILTRO_TODOS, label: 'Todos' },
  { value: 'usuario', label: 'Personas' },
  { value: 'sistema', label: 'Sistema' },
]

interface AuditoriaFiltrosProps {
  filtros: FiltrosAuditoria
  opciones: OpcionesAuditoria
  onCambios: (cambios: Partial<FiltrosAuditoria>) => void
  onLimpiar: () => void
}

export function AuditoriaFiltros({
  filtros,
  opciones,
  onCambios,
  onLimpiar,
}: AuditoriaFiltrosProps) {
  const { busqueda, entidad, campo, usuarioId, actorTipo, origen, desde, hasta, orden } = filtros

  const opcionesEntidad: OpcionCombo[] = [
    { valor: FILTRO_TODOS, etiqueta: 'Todas' },
    ...opciones.entidades.map((valor) => ({ valor, etiqueta: etiquetaEntidad(valor) })),
  ]
  const opcionesUsuario: OpcionCombo[] = [
    { valor: FILTRO_TODOS, etiqueta: 'Todos' },
    ...opciones.usuarios.map((usuario) => ({
      valor: usuario.id,
      etiqueta: etiquetaUsuario(usuario),
      detalle: usuario.nombre ? usuario.email : undefined,
    })),
  ]

  const entidadElegida = opcionesEntidad.find((opcion) => opcion.valor === entidad)
  const usuarioElegido = opcionesUsuario.find((opcion) => opcion.valor === usuarioId)
  const etiquetaOrigenActual = opciones.origenes.find((valor) => valor === origen)
  const etiquetaActorActual = OPCIONES_ACTOR.find((opcion) => opcion.value === actorTipo)
  const etiquetaOrdenActual = OPCIONES_ORDEN.find((opcion) => opcion.value === orden)

  return (
    <div className="flex flex-col gap-3">
      {/* Dos filas: buscar y ordenar arriba, los criterios abajo. Los nueve controles en una
          sola barra quedaban apretados y envolvían de cualquier manera. Todos miden 40px, y
          las fechas se identifican con "Desde"/"Hasta" en vez de un label arriba, que las
          dejaba 4px más altas que los desplegables y desalineaba la fila. */}
      <FilterBar>
        <FilterSearch
          value={busqueda}
          onChange={(valor) => onCambios({ busqueda: valor })}
          placeholder="Buscar entidad, campo, valor o usuario"
        />
        <FilterBarSpacer />
        <FilterDropdown
          label={etiquetaOrdenActual?.label ?? 'Ordenar por'}
          icon={ArrowDownAZIcon}
          align="end"
          options={OPCIONES_ORDEN}
          value={orden}
          onChange={(valor) => onCambios({ orden: valor as OrdenAuditoria })}
        />
      </FilterBar>

      <FilterBar>
        {/* Entidad y usuario son listas largas: el buscador interno evita que el desplegable
            se vuelva inmanejable y deja elegir cualquier opción. */}
        <ComboboxBuscable
          opciones={opcionesEntidad}
          valor={entidad}
          onElegir={(valor) => onCambios({ entidad: valor })}
        >
          <FilterTrigger
            label={
              entidad !== FILTRO_TODOS && entidadElegida
                ? `Entidad: ${entidadElegida.etiqueta}`
                : 'Entidad'
            }
            active={entidad !== FILTRO_TODOS}
            role="combobox"
            aria-label="Entidad"
          />
        </ComboboxBuscable>
        <FilterDropdown
          label="Campo"
          options={[
            { value: FILTRO_TODOS, label: 'Todos' },
            ...opciones.campos.map((valor) => ({ value: valor, label: formatearCampo(valor) })),
          ]}
          value={campo}
          active={campo !== FILTRO_TODOS}
          onChange={(valor) => onCambios({ campo: valor })}
        />
        <FilterDropdown
          label="Realizado por"
          options={OPCIONES_ACTOR}
          value={actorTipo}
          active={actorTipo !== FILTRO_TODOS}
          onChange={(valor) => onCambios({ actorTipo: valor })}
        />
        <ComboboxBuscable
          opciones={opcionesUsuario}
          valor={usuarioId}
          onElegir={(valor) => onCambios({ usuarioId: valor })}
        >
          <FilterTrigger
            label={
              usuarioId !== FILTRO_TODOS && usuarioElegido
                ? `Usuario: ${usuarioElegido.etiqueta}`
                : 'Usuario'
            }
            active={usuarioId !== FILTRO_TODOS}
            role="combobox"
            aria-label="Usuario"
          />
        </ComboboxBuscable>
        <FilterDropdown
          label="Origen"
          options={[
            { value: FILTRO_TODOS, label: 'Todos' },
            ...opciones.origenes.map((valor) => ({
              value: valor,
              label: formatearCampo(valor),
            })),
          ]}
          value={origen}
          active={origen !== FILTRO_TODOS}
          onChange={(valor) => onCambios({ origen: valor })}
        />
        {/* El rango de fechas va como un bloque propio: así envuelve entero y nunca queda
            "Desde" en un renglón y "Hasta" en el siguiente. */}
        <div className="flex shrink-0 items-center gap-2">
          <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-borde sm:block" />
          <DatePicker
            id="auditoria-desde"
            className="h-10 w-40"
            value={desde ? parsearFechaISO(desde) : undefined}
            onChange={(fecha) => onCambios({ desde: fecha ? fechaAISO(fecha) : '' })}
            placeholder="Desde"
          />
          <DatePicker
            id="auditoria-hasta"
            className="h-10 w-40"
            value={hasta ? parsearFechaISO(hasta) : undefined}
            onChange={(fecha) => onCambios({ hasta: fecha ? fechaAISO(fecha) : '' })}
            placeholder="Hasta"
          />
        </div>
      </FilterBar>

      {hayFiltrosAuditoria(filtros) && (
        <FilterChips onClearAll={onLimpiar}>
          {busqueda.trim() !== '' && (
            <FilterChip onRemove={() => onCambios({ busqueda: '' })}>
              Búsqueda: {busqueda}
            </FilterChip>
          )}
          {entidad !== FILTRO_TODOS && (
            <FilterChip onRemove={() => onCambios({ entidad: FILTRO_TODOS })}>
              Entidad: {etiquetaEntidad(entidad)}
            </FilterChip>
          )}
          {campo !== FILTRO_TODOS && (
            <FilterChip onRemove={() => onCambios({ campo: FILTRO_TODOS })}>
              Campo: {formatearCampo(campo)}
            </FilterChip>
          )}
          {usuarioId !== FILTRO_TODOS && (
            <FilterChip onRemove={() => onCambios({ usuarioId: FILTRO_TODOS })}>
              Usuario: {usuarioElegido?.etiqueta ?? '—'}
            </FilterChip>
          )}
          {actorTipo !== FILTRO_TODOS && (
            <FilterChip onRemove={() => onCambios({ actorTipo: FILTRO_TODOS })}>
              Realizado por: {etiquetaActorActual?.label ?? actorTipo}
            </FilterChip>
          )}
          {origen !== FILTRO_TODOS && (
            <FilterChip onRemove={() => onCambios({ origen: FILTRO_TODOS })}>
              Origen: {formatearCampo(etiquetaOrigenActual ?? origen)}
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
        </FilterChips>
      )}
    </div>
  )
}
