import { SearchIcon, TriangleAlertIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SIN_DOCENTE, type FiltroHorario, type FiltroTipoMateria } from '@/modules/academico/utils'

const OPCIONES_TIPO: { value: FiltroTipoMateria; label: string }[] = [
  { value: 'todos', label: 'Todas' },
  { value: 'materia', label: 'Materias' },
  { value: 'taller', label: 'Talleres' },
]

function tipoValido(valor: string): FiltroTipoMateria {
  return OPCIONES_TIPO.find((opcion) => opcion.value === valor)?.value ?? 'todos'
}

interface FiltrosHorarioProps {
  filtro: FiltroHorario
  onFiltro: (filtro: FiltroHorario) => void
  docentes: string[]
  /** Cantidad de materias con franjas superpuestas. */
  conflictos: number
  soloConflictos: boolean
  onSoloConflictos: (activo: boolean) => void
}

export function FiltrosHorario({
  filtro,
  onFiltro,
  docentes,
  conflictos,
  soloConflictos,
  onSoloConflictos,
}: FiltrosHorarioProps) {
  return (
    <>
      <div className="relative w-full sm:w-56">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-texto-3"
          aria-hidden="true"
        />
        <Input
          type="search"
          aria-label="Buscar materia en el horario"
          placeholder="Buscar materia"
          className="pl-8"
          value={filtro.texto}
          onChange={(evento) => onFiltro({ ...filtro, texto: evento.target.value })}
        />
      </div>
      <Select
        value={filtro.tipo}
        onValueChange={(valor) => onFiltro({ ...filtro, tipo: tipoValido(valor) })}
      >
        <SelectTrigger className="w-28" aria-label="Filtrar por tipo">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPCIONES_TIPO.map((opcion) => (
            <SelectItem key={opcion.value} value={opcion.value}>
              {opcion.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filtro.docente} onValueChange={(docente) => onFiltro({ ...filtro, docente })}>
        <SelectTrigger className="w-48" aria-label="Filtrar por docente">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los docentes</SelectItem>
          <SelectItem value={SIN_DOCENTE}>Sin docente</SelectItem>
          {docentes.map((docente) => (
            <SelectItem key={docente} value={docente}>
              {docente}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {conflictos > 0 && (
        <Button
          variant={soloConflictos ? 'secondary' : 'ghost'}
          size="sm"
          aria-pressed={soloConflictos}
          className="text-error"
          onClick={() => onSoloConflictos(!soloConflictos)}
        >
          <TriangleAlertIcon />
          {conflictos === 1 ? '1 materia superpuesta' : `${conflictos} materias superpuestas`}
        </Button>
      )}
    </>
  )
}
