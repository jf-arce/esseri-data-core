import { useEffect, useMemo, useState } from 'react'
import { ChevronsUpDownIcon } from 'lucide-react'
import { FilterBar, FilterBarSpacer } from '@/components/filter-bar'
import { FilterChip, FilterChips, FilterDropdown } from '@/components/filter-dropdown'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { listarAlumnos } from '@/modules/familias-alumnos/services/listar-alumnos'
import { listarFamilias } from '@/modules/familias-alumnos/services/listar-familias'
import type { Alumno, Familia } from '@/modules/familias-alumnos/types'
import { listarConceptosCobro } from '@/modules/facturacion/services/listar-conceptos-cobro'
import type { ConceptoCobro, EstadoFactura, FiltroDebitoFactura } from '@/modules/facturacion/types'
import { etiquetaEstadoFactura } from '@/modules/facturacion/utils'

const OPCIONES_DEBITO = [
  { value: 'todos', label: 'Todos' },
  { value: 'rechazado', label: 'Con débito rechazado' },
  { value: 'cobrado', label: 'Con débito cobrado' },
]

const OPCIONES_ESTADO = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'vencida', label: 'Vencida' },
  { value: 'pagada', label: 'Pagada' },
]

interface FacturasFiltrosProps {
  estado: EstadoFactura | ''
  debito: FiltroDebitoFactura | ''
  alumnoId: string
  familiaResponsableId: string
  conceptoCobroId: string
  onEstadoChange: (estado: EstadoFactura | '') => void
  onDebitoChange: (debito: FiltroDebitoFactura | '') => void
  onAlumnoChange: (alumnoId: string) => void
  onFamiliaResponsableChange: (familiaId: string) => void
  onConceptoCobroChange: (conceptoCobroId: string) => void
}

export function FacturasFiltros(props: FacturasFiltrosProps) {
  const [alumnos, setAlumnos] = useState<Alumno[]>([])
  const [familias, setFamilias] = useState<Familia[]>([])
  const [conceptos, setConceptos] = useState<ConceptoCobro[]>([])
  const [abierto, setAbierto] = useState(false)
  const [abiertoFamilia, setAbiertoFamilia] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [busquedaFamilia, setBusquedaFamilia] = useState('')
  const {
    alumnoId,
    familiaResponsableId,
    conceptoCobroId,
    estado,
    debito,
    onAlumnoChange,
    onFamiliaResponsableChange,
    onConceptoCobroChange,
    onEstadoChange,
    onDebitoChange,
  } = props

  useEffect(() => {
    Promise.all([listarAlumnos(), listarFamilias(), listarConceptosCobro()]).then(
      ([alumnosApi, familiasApi, conceptosApi]) => {
        setAlumnos(alumnosApi)
        setFamilias(familiasApi)
        setConceptos(conceptosApi)
      },
    )
  }, [])

  const alumnoSeleccionado = alumnos.find((alumno) => alumno.id === alumnoId)
  const familiaSeleccionada = familias.find((familia) => familia.id === familiaResponsableId)
  const conceptoSeleccionado = conceptos.find((concepto) => concepto.id === conceptoCobroId)
  const alumnosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es-AR')
    if (!termino) return alumnos
    return alumnos.filter((alumno) =>
      [alumno.persona_nombre, alumno.persona_apellido, alumno.persona_dni, alumno.numero_legajo]
        .join(' ')
        .toLocaleLowerCase('es-AR')
        .includes(termino),
    )
  }, [alumnos, busqueda])
  const familiasFiltradas = useMemo(() => {
    const termino = busquedaFamilia.trim().toLocaleLowerCase('es-AR')
    if (!termino) return familias
    return familias.filter((familia) =>
      [familia.persona_nombre, familia.persona_apellido, familia.persona_dni]
        .join(' ')
        .toLocaleLowerCase('es-AR')
        .includes(termino),
    )
  }, [familias, busquedaFamilia])

  return (
    <div className="flex flex-col gap-3">
      <FilterBar>
        <Popover open={abiertoFamilia} onOpenChange={setAbiertoFamilia}>
          <PopoverTrigger asChild>
            <Button variant="secondary" className="h-10" aria-expanded={abiertoFamilia}>
              <span className="max-w-48 truncate">
                {familiaSeleccionada
                  ? `${familiaSeleccionada.persona_apellido}, ${familiaSeleccionada.persona_nombre}`
                  : 'Familia'}
              </span>
              <ChevronsUpDownIcon data-icon="inline-end" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Nombre, apellido o DNI"
                value={busquedaFamilia}
                onValueChange={setBusquedaFamilia}
              />
              <CommandList>
                <CommandEmpty>No encontramos familias.</CommandEmpty>
                <CommandGroup>
                  {familiasFiltradas.map((familia) => (
                    <CommandItem
                      key={familia.id}
                      value={familia.id}
                      onSelect={() => {
                        onFamiliaResponsableChange(familia.id)
                        setAbiertoFamilia(false)
                      }}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {familia.persona_apellido}, {familia.persona_nombre}
                        </span>
                        <span className="text-xs text-texto-2">DNI {familia.persona_dni}</span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Popover open={abierto} onOpenChange={setAbierto}>
          <PopoverTrigger asChild>
            <Button variant="secondary" className="h-10" aria-expanded={abierto}>
              <span className="max-w-48 truncate">
                {alumnoSeleccionado
                  ? `${alumnoSeleccionado.persona_apellido}, ${alumnoSeleccionado.persona_nombre}`
                  : 'Alumno'}
              </span>
              <ChevronsUpDownIcon data-icon="inline-end" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Nombre, apellido, DNI o legajo"
                value={busqueda}
                onValueChange={setBusqueda}
              />
              <CommandList>
                <CommandEmpty>No encontramos alumnos.</CommandEmpty>
                <CommandGroup>
                  {alumnosFiltrados.map((alumno) => (
                    <CommandItem
                      key={alumno.id}
                      value={alumno.id}
                      onSelect={() => {
                        onAlumnoChange(alumno.id)
                        setAbierto(false)
                      }}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {alumno.persona_apellido}, {alumno.persona_nombre}
                        </span>
                        <span className="text-xs text-texto-2">
                          DNI {alumno.persona_dni} · Legajo {alumno.numero_legajo}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <FilterDropdown
          label="Concepto"
          options={[
            { value: 'todos', label: 'Todos' },
            ...conceptos.map((concepto) => ({ value: concepto.id, label: concepto.nombre })),
          ]}
          value={conceptoCobroId || 'todos'}
          active={conceptoCobroId !== ''}
          onChange={(valor) => onConceptoCobroChange(valor === 'todos' ? '' : valor)}
        />
        <FilterDropdown
          label="Estado"
          options={OPCIONES_ESTADO}
          value={estado || 'todos'}
          active={estado !== ''}
          onChange={(valor) => onEstadoChange(valor === 'todos' ? '' : (valor as EstadoFactura))}
        />
        <FilterDropdown
          label="Débito"
          options={OPCIONES_DEBITO}
          value={debito || 'todos'}
          active={debito !== ''}
          onChange={(valor) =>
            onDebitoChange(valor === 'todos' ? '' : (valor as FiltroDebitoFactura))
          }
        />
        <FilterBarSpacer />
      </FilterBar>
      {(estado || debito || alumnoId || familiaResponsableId || conceptoCobroId) && (
        <FilterChips
          onClearAll={() => {
            onEstadoChange('')
            onDebitoChange('')
            onAlumnoChange('')
            onFamiliaResponsableChange('')
            onConceptoCobroChange('')
          }}
        >
          {familiaSeleccionada && (
            <FilterChip onRemove={() => onFamiliaResponsableChange('')}>
              Familia: {familiaSeleccionada.persona_apellido}, {familiaSeleccionada.persona_nombre}
            </FilterChip>
          )}
          {alumnoSeleccionado && (
            <FilterChip onRemove={() => onAlumnoChange('')}>
              Alumno: {alumnoSeleccionado.persona_apellido}, {alumnoSeleccionado.persona_nombre}
            </FilterChip>
          )}
          {conceptoSeleccionado && (
            <FilterChip onRemove={() => onConceptoCobroChange('')}>
              Concepto: {conceptoSeleccionado.nombre}
            </FilterChip>
          )}
          {estado && (
            <FilterChip onRemove={() => onEstadoChange('')}>
              Estado: {etiquetaEstadoFactura(estado)}
            </FilterChip>
          )}
          {debito && (
            <FilterChip onRemove={() => onDebitoChange('')}>
              Débito: {debito === 'rechazado' ? 'Rechazado' : 'Cobrado'}
            </FilterChip>
          )}
        </FilterChips>
      )}
    </div>
  )
}
