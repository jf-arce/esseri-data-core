import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MateriaCurso } from '@/modules/academico/types'
import { calcularGrilla, deMinutos } from '@/modules/academico/utils'

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

export type HuecoHorario = { dia_semana: number; hora_inicio: string; hora_fin: string }

interface HorarioSemanalProps {
  materiasCurso: MateriaCurso[]
  puedeEditar: boolean
  onEditar: (materiaCurso: MateriaCurso) => void
  onAgregar: (hueco?: HuecoHorario) => void
}

type FranjaConMateria = {
  dia_semana: number
  hora_inicio: string
  hora_fin: string
  materiaCurso: MateriaCurso
}

export function HorarioSemanal({
  materiasCurso,
  puedeEditar,
  onEditar,
  onAgregar,
}: HorarioSemanalProps) {
  const franjas: FranjaConMateria[] = materiasCurso.flatMap((materiaCurso) =>
    materiaCurso.horarios.map((horario) => ({
      dia_semana: horario.dia_semana,
      hora_inicio: horario.hora_inicio,
      hora_fin: horario.hora_fin,
      materiaCurso,
    })),
  )
  const grilla = calcularGrilla(franjas)
  const filas = Array.from({ length: grilla.filas }, (_, i) => grilla.inicio + i * 30)

  return (
    <div className="flex flex-col gap-3">
      {puedeEditar && (
        <Button variant="secondary" size="sm" className="self-start" onClick={() => onAgregar()}>
          <PlusIcon />
          Agregar materia
        </Button>
      )}
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[640px] gap-px rounded-card-sm bg-borde text-sm"
          style={{
            gridTemplateColumns: `3.5rem repeat(${grilla.dias.length}, minmax(0, 1fr))`,
            gridTemplateRows: `2rem repeat(${grilla.filas}, 1.75rem)`,
          }}
        >
          <div className="bg-superficie" style={{ gridRow: 1, gridColumn: 1 }} />
          {grilla.dias.map((dia, i) => (
            <div
              key={dia}
              className="flex items-center justify-center bg-superficie font-semibold text-texto capitalize"
              style={{ gridRow: 1, gridColumn: i + 2 }}
            >
              {DIAS[dia - 1]}
            </div>
          ))}

          {filas.map((minutos, i) => (
            <div
              key={minutos}
              className="bg-superficie pr-2 text-right text-xs text-texto-3"
              style={{ gridRow: i + 2, gridColumn: 1 }}
            >
              {minutos % 60 === 0 ? deMinutos(minutos) : ''}
            </div>
          ))}

          {filas.flatMap((minutos, i) =>
            grilla.dias.map((dia, j) =>
              puedeEditar ? (
                // Atajo de mouse: el camino de teclado es el botón "Agregar materia".
                <button
                  key={`${dia}-${minutos}`}
                  type="button"
                  tabIndex={-1}
                  aria-hidden="true"
                  className="cursor-pointer bg-superficie hover:bg-fila-hover"
                  style={{ gridRow: i + 2, gridColumn: j + 2 }}
                  onClick={() =>
                    onAgregar({
                      dia_semana: dia,
                      hora_inicio: deMinutos(minutos),
                      hora_fin: deMinutos(minutos + 60),
                    })
                  }
                />
              ) : (
                <div
                  key={`${dia}-${minutos}`}
                  className="bg-superficie"
                  style={{ gridRow: i + 2, gridColumn: j + 2 }}
                />
              ),
            ),
          )}

          {grilla.bloques.map((bloque) => {
            const { materiaCurso } = bloque.origen
            const nombre = materiaCurso.materia_nombre ?? 'Materia'
            const rango = `${bloque.origen.hora_inicio.slice(0, 5)} a ${bloque.origen.hora_fin.slice(0, 5)}`
            const clases = `z-10 flex min-w-0 flex-col overflow-hidden border px-2 py-1 text-left text-xs ${
              bloque.superpuesto
                ? 'border-error bg-error-suave text-error'
                : 'border-transparent bg-info-suave text-info'
            }`
            const estilo = {
              gridColumn: bloque.columna,
              gridRow: `${bloque.filaInicio} / ${bloque.filaFin}`,
            }
            const contenido = (
              <>
                <span className="truncate font-semibold">{nombre}</span>
                <span className="truncate">{rango}</span>
              </>
            )
            const etiqueta = `${nombre}, ${DIAS[bloque.origen.dia_semana - 1]} de ${rango}${
              bloque.superpuesto ? ' (horario superpuesto)' : ''
            }`
            return puedeEditar ? (
              <button
                key={bloque.clave}
                type="button"
                aria-label={etiqueta}
                className={`${clases} cursor-pointer hover:brightness-95 focus-visible:outline-2 focus-visible:outline-violeta`}
                style={estilo}
                onClick={() => onEditar(materiaCurso)}
              >
                {contenido}
              </button>
            ) : (
              <div
                key={bloque.clave}
                role="img"
                aria-label={etiqueta}
                className={clases}
                style={estilo}
              >
                {contenido}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
