import { cn } from '@/lib/utils'
import type { LogicaCondicion } from '@/modules/workflows/types'

const OPCIONES: { valor: LogicaCondicion; texto: string }[] = [
  { valor: 'todas', texto: 'Se cumplen todas (Y)' },
  { valor: 'alguna', texto: 'Se cumple alguna (O)' },
]

interface SelectorLogicaProps {
  valor: LogicaCondicion
  disabled: boolean
  onCambiar: (valor: LogicaCondicion) => void
}

/** Dos opciones juntas; el fondo se desliza hacia la que está aplicada. */
export function SelectorLogica({ valor, disabled, onCambiar }: SelectorLogicaProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Cuándo se cumple"
      className="relative grid w-full grid-cols-2 rounded-lg bg-fila-hover p-[3px]"
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-[3px] left-[3px] w-[calc(50%-3px)] rounded-md bg-violeta shadow-card transition-transform duration-200 ease-out',
          valor === 'alguna' && 'translate-x-full',
        )}
      />
      {OPCIONES.map((opcion) => (
        <button
          key={opcion.valor}
          type="button"
          role="radio"
          aria-checked={valor === opcion.valor}
          disabled={disabled}
          onClick={() => onCambiar(opcion.valor)}
          className={cn(
            'relative z-10 cursor-pointer rounded-md px-2 py-1.5 text-sm font-semibold transition-colors disabled:cursor-default',
            valor === opcion.valor ? 'text-superficie' : 'text-texto-3 hover:text-texto',
          )}
        >
          {opcion.texto}
        </button>
      ))}
    </div>
  )
}
