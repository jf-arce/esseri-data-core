import { TriangleAlertIcon, UserPlusIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { MateriaSinDocente } from '@/modules/academico/types'
import { colorMateria, etiquetaCurso } from '@/modules/academico/utils'

interface AvisoMateriasSinDocenteProps {
  materias: MateriaSinDocente[]
  ciclo: string
  puedeEditar: boolean
  /** Lleva al curso de la materia, con su tarjeta resaltada. */
  onIrA: (materia: MateriaSinDocente) => void
  /** Abre la asignación de docente de esa materia sin salir de la página. */
  onAsignar: (materia: MateriaSinDocente) => void
}

type GrupoCurso = { id: string; etiqueta: string; materias: MateriaSinDocente[] }
type GrupoNivel = { id: string; nombre: string; cursos: GrupoCurso[] }

// Las materias llegan ordenadas por nivel, año, división y materia: alcanza con agrupar en orden.
function agrupar(materias: MateriaSinDocente[]): GrupoNivel[] {
  const niveles: GrupoNivel[] = []
  for (const materia of materias) {
    let nivel = niveles.find((n) => n.id === materia.nivel_educativo_id)
    if (!nivel) {
      nivel = { id: materia.nivel_educativo_id, nombre: materia.nivel_educativo_nombre, cursos: [] }
      niveles.push(nivel)
    }
    let curso = nivel.cursos.find((c) => c.id === materia.division_id)
    if (!curso) {
      curso = {
        id: materia.division_id,
        etiqueta: etiquetaCurso(materia.anio_numero, materia.division_nombre),
        materias: [],
      }
      nivel.cursos.push(curso)
    }
    curso.materias.push(materia)
  }
  return niveles
}

export function AvisoMateriasSinDocente({
  materias,
  ciclo,
  puedeEditar,
  onIrA,
  onAsignar,
}: AvisoMateriasSinDocenteProps) {
  const [abierto, setAbierto] = useState(false)
  if (materias.length === 0) return null

  const texto = `${materias.length} ${materias.length === 1 ? 'materia sin docente' : 'materias sin docente'}`

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          className="border border-advertencia bg-transparent text-advertencia hover:text-advertencia"
        >
          <TriangleAlertIcon aria-hidden="true" />
          {texto}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] max-w-[calc(100vw-2rem)] p-0">
        <div className="border-b border-borde px-4 py-3 text-sm font-semibold text-texto">
          Materias sin docente · ciclo {ciclo}
        </div>
        <ScrollArea className="max-h-96">
          <div className="flex flex-col gap-4 p-4">
            {agrupar(materias).map((nivel) => (
              <section key={nivel.id} className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold tracking-wide text-texto-2 uppercase">
                  {nivel.nombre}
                </h3>
                {nivel.cursos.map((curso) => (
                  <div key={curso.id} className="flex flex-col gap-1">
                    <p className="text-sm font-semibold text-texto">{curso.etiqueta}</p>
                    <ul className="flex flex-col">
                      {curso.materias.map((materia) => (
                        <li key={materia.materia_curso_id} className="flex items-center gap-1">
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-texto hover:bg-fila-hover"
                            onClick={() => {
                              setAbierto(false)
                              onIrA(materia)
                            }}
                          >
                            <span
                              className="size-2.5 shrink-0 rounded-full"
                              style={{
                                backgroundColor: colorMateria(materia.materia_color).estilo
                                  .backgroundColor,
                              }}
                              aria-hidden="true"
                            />
                            <span className="truncate">{materia.materia_nombre}</span>
                          </button>
                          {puedeEditar && (
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Asignar docente a ${materia.materia_nombre} de ${curso.etiqueta}`}
                              onClick={() => {
                                setAbierto(false)
                                onAsignar(materia)
                              }}
                            >
                              <UserPlusIcon aria-hidden="true" />
                              Asignar
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
