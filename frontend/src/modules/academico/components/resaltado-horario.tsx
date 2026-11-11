import { ChevronDownIcon } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { MateriaCurso } from '@/modules/academico/types'
import { colorMateria } from '@/modules/academico/utils'

interface ResaltadoHorarioProps {
  materiasCurso: MateriaCurso[]
  /** Materias marcadas: el resto de los bloques se atenúa. */
  marcadas: string[]
  /** Resaltado temporal al pasar el mouse por una materia de la lista. */
  onResaltar: (materiaCursoId: string | null) => void
  onAlternar: (materiaCursoId: string) => void
}

export function ResaltadoHorario({
  materiasCurso,
  marcadas,
  onResaltar,
  onAlternar,
}: ResaltadoHorarioProps) {
  const ordenadas = [...materiasCurso].sort((a, b) =>
    (a.materia_nombre ?? '').localeCompare(b.materia_nombre ?? '', 'es'),
  )

  return (
    <Popover onOpenChange={(abierto) => !abierto && onResaltar(null)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Resaltar materias"
          className="flex h-9 w-32 cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-borde bg-superficie px-3 text-sm whitespace-nowrap text-texto transition-colors outline-none select-none focus-visible:outline-2 focus-visible:outline-violeta"
        >
          <span className="truncate">Materias{marcadas.length > 0 && ` · ${marcadas.length}`}</span>
          <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-texto-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-0.5 p-1">
        <ul aria-label="Materias a resaltar" className="max-h-72 overflow-y-auto">
          {ordenadas.map((materiaCurso) => {
            const marcada = marcadas.includes(materiaCurso.id)
            const { backgroundColor, color } = colorMateria(materiaCurso.materia_color).estilo
            return (
              <li key={materiaCurso.id}>
                <label
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-fila-hover"
                  onMouseEnter={() => onResaltar(materiaCurso.id)}
                  onMouseLeave={() => onResaltar(null)}
                >
                  <Checkbox
                    checked={marcada}
                    onCheckedChange={() => onAlternar(materiaCurso.id)}
                    style={
                      marcada
                        ? { backgroundColor, borderColor: backgroundColor, color }
                        : { borderColor: backgroundColor }
                    }
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {materiaCurso.materia_nombre ?? 'Materia'}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
