import { ContactRoundIcon, MonitorIcon, XIcon, type LucideIcon } from 'lucide-react'
import type { Fijado, TipoMencion } from '../types'
import { TIPO_FIJADO, type Tipo } from './tipos-de-contexto'

// El tipo va como ícono (y como texto para lectores de pantalla y tooltip) para no alargar el chip.
/** Dónde está la persona: en la ficha de alguien (se ve su nombre) o en una pantalla. */
export type ChipPantalla = { tipo: 'ficha' | 'pantalla'; texto: string }

const TIPO_PANTALLA: Record<ChipPantalla['tipo'], Tipo> = {
  ficha: {
    etiqueta: 'Viendo',
    icono: ContactRoundIcon,
    color: 'text-exito',
  },
  pantalla: {
    etiqueta: 'Pantalla',
    icono: MonitorIcon,
    color: 'text-violeta',
  },
}

interface ChipsContextoProps {
  /** Lo que se usa por estar donde está: la ficha que mira o la pantalla en que está. */
  pantalla: ChipPantalla | null
  onQuitarPantalla: () => void
  fijados: Fijado[]
  /** Cuántos se pueden fijar: al llegar, la lista avisa. */
  maximo: number
  onQuitarFijado: (tipo: TipoMencion, entidadId: string) => void
}

function Chip({
  icono: Icono,
  color,
  tipo,
  texto,
  etiquetaQuitar,
  onQuitar,
}: {
  icono: LucideIcon
  color: string
  tipo: string
  texto: string
  etiquetaQuitar: string
  onQuitar: () => void
}) {
  return (
    <li
      title={`${tipo}: ${texto}`}
      className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-borde bg-fila-hover py-0.5 pr-1 pl-2 text-xs text-texto"
    >
      <Icono aria-hidden className={`size-3.5 shrink-0 ${color}`} />
      <span className="sr-only">{tipo}: </span>
      <span className="min-w-0 break-words">{texto}</span>
      <button
        type="button"
        onClick={onQuitar}
        aria-label={etiquetaQuitar}
        className="cursor-pointer rounded-full p-0.5 hover:bg-texto/10"
      >
        <XIcon className="size-3" />
      </button>
    </li>
  )
}

/**
 * Todo lo que el asistente está usando como contexto, a la vista: la pantalla o ficha actual y lo
 * que la persona fijó con `@` (alumnos, familias, docentes, cursos). Cada uno se puede sacar.
 */
export function ChipsContexto({
  pantalla,
  onQuitarPantalla,
  fijados,
  maximo,
  onQuitarFijado,
}: ChipsContextoProps) {
  if (pantalla === null && fijados.length === 0) return null
  // Los chips que entren en una fila van juntos; recién cuando no cabe otro, baja a la siguiente.
  // El nombre se muestra completo (si es más largo que la fila, sigue en otra línea del mismo
  // chip) y la lista no pasa de dos filas: el resto se ve con scroll.
  return (
    <div className="mb-2">
      <ul
        aria-label="Contexto de la consulta"
        className="flex max-h-14 flex-row flex-wrap items-center gap-1.5 overflow-y-auto"
      >
        {pantalla !== null && (
          <Chip
            icono={TIPO_PANTALLA[pantalla.tipo].icono}
            color={TIPO_PANTALLA[pantalla.tipo].color}
            tipo={TIPO_PANTALLA[pantalla.tipo].etiqueta}
            texto={pantalla.texto}
            etiquetaQuitar="Dejar de usar la pantalla como contexto"
            onQuitar={onQuitarPantalla}
          />
        )}
        {fijados.map((fijado) => (
          <Chip
            key={`${fijado.tipo}:${fijado.entidad_id}`}
            icono={TIPO_FIJADO[fijado.tipo].icono}
            color={TIPO_FIJADO[fijado.tipo].color}
            tipo={TIPO_FIJADO[fijado.tipo].etiqueta}
            texto={fijado.nombre}
            etiquetaQuitar={`Dejar de usar a ${fijado.nombre} como contexto`}
            onQuitar={() => onQuitarFijado(fijado.tipo, fijado.entidad_id)}
          />
        ))}
      </ul>
      {fijados.length >= maximo && (
        <p role="status" className="mt-1 text-xs text-texto-3">
          Llegaste al máximo de {maximo}. Sacá alguno para sumar otro.
        </p>
      )}
    </div>
  )
}
