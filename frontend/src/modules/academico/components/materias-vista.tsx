import { SearchIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AgregarMateriaCard,
  MateriaCursoCard,
} from '@/modules/academico/components/materia-curso-card'
import type { AsignacionDocente, DocenteDeMateria, MateriaCurso } from '@/modules/academico/types'
import {
  FILTRO_MATERIAS_INICIAL,
  filtrarYOrdenarMaterias,
  materiasEnConflicto,
  type FiltroMaterias,
  type FiltroTipoMateria,
  type OrdenMaterias,
} from '@/modules/academico/utils'

const OPCIONES_TIPO: { value: FiltroTipoMateria; label: string }[] = [
  { value: 'todos', label: 'Todas' },
  { value: 'materia', label: 'Materias' },
  { value: 'taller', label: 'Talleres' },
]

const OPCIONES_ORDEN: { value: OrdenMaterias; label: string }[] = [
  { value: 'nombre', label: 'Por nombre' },
  { value: 'dia', label: 'Por día' },
  { value: 'sin-docente', label: 'Sin docente primero' },
]

function tipoValido(valor: string): FiltroTipoMateria {
  return OPCIONES_TIPO.find((opcion) => opcion.value === valor)?.value ?? 'todos'
}

function ordenValido(valor: string): OrdenMaterias {
  return OPCIONES_ORDEN.find((opcion) => opcion.value === valor)?.value ?? 'nombre'
}

interface MateriasVistaProps {
  materiasCurso: MateriaCurso[]
  asignacionesDe: (materiaCurso: MateriaCurso) => DocenteDeMateria[]
  puedeEditar: boolean
  filtro: FiltroMaterias
  onFiltro: (filtro: FiltroMaterias) => void
  onEditar: (materiaCurso: MateriaCurso) => void
  onQuitar: (materiaCurso: MateriaCurso) => void
  onAsignarDocente: (materiaCurso: MateriaCurso) => void
  onEditarAsignacion: (asignacion: AsignacionDocente) => void
  onQuitarAsignacion: (asignacion: AsignacionDocente) => void
  onVerHorario: (materiaCurso: MateriaCurso) => void
  onAgregar: () => void
}

export function MateriasVista({
  materiasCurso,
  asignacionesDe,
  puedeEditar,
  filtro,
  onFiltro,
  onEditar,
  onQuitar,
  onAsignarDocente,
  onEditarAsignacion,
  onQuitarAsignacion,
  onVerHorario,
  onAgregar,
}: MateriasVistaProps) {
  const visibles = filtrarYOrdenarMaterias(
    materiasCurso,
    filtro,
    (materiaCurso) => asignacionesDe(materiaCurso).length,
  )
  const hayFiltro = filtro.texto !== '' || filtro.tipo !== 'todos'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-texto-3"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Buscar materia"
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
          <SelectTrigger className="w-32" aria-label="Filtrar por tipo">
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
        <Select
          value={filtro.orden}
          onValueChange={(valor) => onFiltro({ ...filtro, orden: ordenValido(valor) })}
        >
          <SelectTrigger className="w-48" aria-label="Ordenar materias">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPCIONES_ORDEN.map((opcion) => (
              <SelectItem key={opcion.value} value={opcion.value}>
                {opcion.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hayFiltro && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFiltro({ ...FILTRO_MATERIAS_INICIAL, orden: filtro.orden })}
          >
            <XIcon />
            Limpiar
          </Button>
        )}
      </div>

      {visibles.length === 0 ? (
        <p className="py-8 text-center text-sm text-texto-3">
          Ninguna materia coincide con la búsqueda.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibles.map((materiaCurso) => (
            <MateriaCursoCard
              key={materiaCurso.id}
              materiaCurso={materiaCurso}
              docentes={asignacionesDe(materiaCurso)}
              conflictos={materiasEnConflicto(materiaCurso, materiasCurso)}
              puedeEditar={puedeEditar}
              onEditar={onEditar}
              onQuitar={onQuitar}
              onAsignarDocente={onAsignarDocente}
              onEditarAsignacion={onEditarAsignacion}
              onQuitarAsignacion={onQuitarAsignacion}
              onVerHorario={onVerHorario}
            />
          ))}
          {puedeEditar && <AgregarMateriaCard onAgregar={onAgregar} />}
        </div>
      )}
    </div>
  )
}
