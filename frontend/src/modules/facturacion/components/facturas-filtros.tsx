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
import type { Alumno } from '@/modules/familias-alumnos/types'
import { listarConceptosCobro } from '@/modules/facturacion/services/listar-conceptos-cobro'
import type { ConceptoCobro, EstadoFactura } from '@/modules/facturacion/types'
import { etiquetaEstadoFactura } from '@/modules/facturacion/utils'

const OPCIONES_ESTADO = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'vencida', label: 'Vencida' },
  { value: 'pagada', label: 'Pagada' },
]

interface FacturasFiltrosProps {
  estado: EstadoFactura | ''
  alumnoId: string
  conceptoCobroId: string
  onEstadoChange: (estado: EstadoFactura | '') => void
  onAlumnoChange: (alumnoId: string) => void
  onConceptoCobroChange: (conceptoCobroId: string) => void
}

export function FacturasFiltros(props: FacturasFiltrosProps) {
  const [alumnos, setAlumnos] = useState<Alumno[]>([])
  const [conceptos, setConceptos] = useState<ConceptoCobro[]>([])
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const {
    alumnoId,
    conceptoCobroId,
    estado,
    onAlumnoChange,
    onConceptoCobroChange,
    onEstadoChange,
  } = props

  useEffect(() => {
    Promise.all([listarAlumnos(), listarConceptosCobro()]).then(([alumnosApi, conceptosApi]) => {
      setAlumnos(alumnosApi)
      setConceptos(conceptosApi)
    })
  }, [])

  const alumnoSeleccionado = alumnos.find((alumno) => alumno.id === alumnoId)
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

  return (
    <div className="flex flex-col gap-3">
      <FilterBar>
        <Popover open={abierto} onOpenChange={setAbierto}>
          <PopoverTrigger asChild>
            <Button variant="secondary" className="h-10 rounded-full" aria-expanded={abierto}>
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
        <FilterBarSpacer />
      </FilterBar>
      {(estado || alumnoId || conceptoCobroId) && (
        <FilterChips
          onClearAll={() => {
            onEstadoChange('')
            onAlumnoChange('')
            onConceptoCobroChange('')
          }}
        >
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
        </FilterChips>
      )}
    </div>
  )
}
