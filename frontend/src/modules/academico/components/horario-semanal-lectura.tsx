import type { FranjaConMateria, MateriaCurso } from '@/modules/academico/types'
import {
  aMinutos,
  calcularGrilla,
  colorMateria,
  deMinutos,
  DIAS,
  particionarSolapados,
  posicionBloque,
  rangoLegible,
} from '@/modules/academico/utils'

interface HorarioSemanalLecturaProps {
  materiasCurso: MateriaCurso[]
  /** Nombre del alumno, para el texto accesible de cada bloque. */
  alumno?: string
  /** Día a resaltar (1 = lunes). Por defecto, el día de hoy. */
  diaActual?: number
}

function diaDeHoy(): number {
  const dia = new Date().getDay()
  return dia === 0 ? 7 : dia
}

/**
 * Grilla semanal de solo lectura, con la misma escala y los mismos colores que el horario de
 * Estructura Académica. No tiene arrastre, edición, filtros ni exportación: el Portal Familia
 * únicamente consulta el horario del curso del alumno.
 */
export function HorarioSemanalLectura({
  materiasCurso,
  alumno,
  diaActual = diaDeHoy(),
}: HorarioSemanalLecturaProps) {
  const franjas: FranjaConMateria[] = materiasCurso.flatMap((materiaCurso) =>
    materiaCurso.horarios.map((horario) => ({ ...horario, materiaCurso })),
  )
  const grilla = calcularGrilla(franjas)
  const filas = Array.from({ length: grilla.filas }, (_, i) => grilla.inicio + i * 30)

  const porDia = new Map<number, { franja: FranjaConMateria; superpuesto: boolean }[]>()
  grilla.bloques.forEach((bloque, i) => {
    const lista = porDia.get(bloque.dia) ?? []
    lista.push({ franja: franjas[i], superpuesto: bloque.superpuesto })
    porDia.set(bloque.dia, lista)
  })

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[640px] gap-x-px rounded-card-sm bg-borde text-sm"
        style={{
          gridTemplateColumns: `3.5rem repeat(${grilla.dias.length}, minmax(0, 1fr))`,
          gridTemplateRows: `2rem repeat(${grilla.filas}, 2rem)`,
        }}
      >
        <div className="bg-superficie" style={{ gridRow: 1, gridColumn: 1 }} />
        {grilla.dias.map((dia, i) => {
          const esHoy = dia === diaActual
          return (
            <div
              key={dia}
              className={`relative flex items-center justify-center bg-superficie font-semibold capitalize ${
                esHoy ? 'text-violeta' : 'text-texto'
              }`}
              style={{ gridRow: 1, gridColumn: i + 2 }}
            >
              {DIAS[dia - 1]}
              {esHoy && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-1.5 h-0.5 w-6 rounded-full bg-violeta"
                />
              )}
            </div>
          )
        })}

        {filas.map((minutos, i) => (
          <div
            key={minutos}
            className="relative bg-superficie"
            style={{ gridRow: i + 2, gridColumn: 1 }}
          >
            <span aria-hidden="true" className="absolute top-0 right-0 h-px w-1.5 bg-borde" />
            <span
              className={`absolute top-0 right-3.5 -translate-y-1/2 text-xs leading-none ${
                minutos % 60 === 0 ? 'text-texto-2' : 'text-texto-3/70'
              }`}
            >
              {deMinutos(minutos)}
            </span>
          </div>
        ))}

        {filas.flatMap((minutos, i) =>
          grilla.dias.map((dia, j) => (
            <div
              key={`${dia}-${minutos}`}
              className={`border-t border-borde ${
                dia === diaActual ? 'bg-violeta-suave/40' : 'bg-superficie'
              }`}
              style={{ gridRow: i + 2, gridColumn: j + 2 }}
            />
          )),
        )}

        {grilla.dias.map((dia, j) => {
          const delDia = porDia.get(dia) ?? []
          const carriles = particionarSolapados(delDia.map(({ franja }) => franja))
          return (
            <div
              key={dia}
              className="pointer-events-none relative"
              style={{ gridRow: '2 / -1', gridColumn: j + 2 }}
            >
              {delDia.map(({ franja, superpuesto }, i) => (
                <BloqueLectura
                  key={`${franja.materiaCurso.id}-${franja.id}`}
                  franja={franja}
                  alumno={alumno}
                  superpuesto={superpuesto}
                  {...posicionBloque(franja, grilla)}
                  carril={carriles[i].carril}
                  carriles={carriles[i].carriles}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface BloqueLecturaProps {
  franja: FranjaConMateria
  alumno?: string
  superpuesto: boolean
  top: number
  alto: number
  carril: number
  carriles: number
}

function BloqueLectura({
  franja,
  alumno,
  superpuesto,
  top,
  alto,
  carril,
  carriles,
}: BloqueLecturaProps) {
  const { materiaCurso } = franja
  const nombre = materiaCurso.materia_nombre ?? 'Materia'
  const color = colorMateria(materiaCurso.materia_color)
  const inicio = franja.hora_inicio.slice(0, 5)
  const fin = franja.hora_fin.slice(0, 5)
  const rango = rangoLegible(franja)
  const esTaller = materiaCurso.materia_tipo === 'taller'
  const minutos = aMinutos(franja.hora_fin) - aMinutos(franja.hora_inicio)
  const etiqueta = `${nombre}, ${DIAS[franja.dia_semana - 1]} de ${rango}${
    alumno ? `, ${alumno}` : ''
  }${superpuesto ? ' (horario superpuesto)' : ''}`

  return (
    <div
      className="absolute z-10 px-px"
      style={{
        top: `${top}%`,
        height: `${alto}%`,
        left: `${(carril / carriles) * 100}%`,
        width: `${100 / carriles}%`,
      }}
    >
      <div
        role="group"
        aria-label={etiqueta}
        title={etiqueta}
        className={`flex size-full flex-col overflow-hidden rounded-[3px] border px-2 py-1 text-left text-xs leading-tight ${
          superpuesto ? 'border-error bg-error-suave text-error' : 'border-transparent'
        }`}
        style={superpuesto ? undefined : color.estilo}
      >
        {minutos < 45 ? (
          <span className="truncate">
            <span className="font-semibold">{nombre}</span>
            <span className="opacity-75">
              {' '}
              · {inicio} a {fin}
            </span>
          </span>
        ) : (
          <>
            <span className="w-full truncate font-semibold">{nombre}</span>
            <span className="w-full truncate opacity-75">
              {inicio} a {fin}
            </span>
            {minutos >= 60 && esTaller && (
              <span className="w-full truncate opacity-75">Taller</span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
