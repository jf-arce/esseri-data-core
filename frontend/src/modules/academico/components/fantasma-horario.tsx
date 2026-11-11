import type { VistaPrevia } from '@/modules/academico/hooks/use-arrastre-horario'
import {
  colorMateria,
  posicionBloque,
  rangoLegible,
  type RangoGrilla,
} from '@/modules/academico/utils'

interface FantasmaHorarioProps {
  vista: VistaPrevia
  grilla: Pick<RangoGrilla, 'inicio' | 'fin'>
}

/** Destino de un gesto en curso: rojo si se pisa con otra franja, violeta al crear. */
export function FantasmaHorario({ vista, grilla }: FantasmaHorarioProps) {
  const { top, alto } = posicionBloque(vista.destino, grilla)
  const { franja } = vista
  const estilo =
    franja && !vista.choca ? colorMateria(franja.materiaCurso.materia_color).estilo : undefined
  const clases = vista.choca
    ? 'border-error bg-error-suave text-error'
    : franja
      ? 'border-violeta'
      : 'border-violeta bg-violeta-suave text-violeta'

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-x-0 z-30 flex flex-col overflow-hidden border-2 px-2 py-1 text-xs shadow-card ${clases}`}
      style={{ top: `${top}%`, height: `${alto}%`, ...estilo }}
    >
      <span className="truncate font-semibold">
        {franja?.materiaCurso.materia_nombre ?? 'Nueva materia'}
      </span>
      <span className="truncate">{rangoLegible(vista.destino)}</span>
    </div>
  )
}
