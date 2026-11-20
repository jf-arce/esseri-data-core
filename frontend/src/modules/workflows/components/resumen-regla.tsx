import { ListChecksIcon } from 'lucide-react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import type { TipoEvento } from '@/modules/workflows/types'
import { hijosDe, lineasRegla, type BorradorFlujo } from '@/modules/workflows/utils-grafo'

interface ResumenReglaProps {
  borrador: BorradorFlujo
  tiposEvento: TipoEvento[]
}

const NOTA_SIN_CONDICION =
  'Las acciones sin condición se ejecutan con cada evento de este tipo. Para limitarlas, poné una condición entre el disparador y la acción.'

function haySinCondicion(borrador: BorradorFlujo): boolean {
  // Una acción colgada del disparador no tiene condición: corre con cada evento.
  return hijosDe(borrador.nodos, null).some((n) => n.tipo === 'accion')
}

/** La regla leída en lenguaje natural: la cabecera y una línea por rama. */
export function TextoResumen({ borrador, tiposEvento }: ResumenReglaProps) {
  const [cabecera, ...ramas] = lineasRegla(borrador, tiposEvento)
  return (
    <div className="flex flex-col gap-1.5 text-sm text-texto">
      <p className="first-letter:uppercase">{cabecera}</p>
      {ramas.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-l-2 border-mod-workflows pl-3">
          {ramas.map((rama) => (
            <li key={rama} className="first-letter:uppercase">
              {rama}
            </li>
          ))}
        </ul>
      )}
      {haySinCondicion(borrador) && <p className="text-xs text-texto-2">{NOTA_SIN_CONDICION}</p>}
    </div>
  )
}

/** La regla en lenguaje natural, fuera de la vista: un ícono sobre el lienzo que la muestra al
 * pasar el mouse (o al enfocarlo con el teclado). */
export function ResumenRegla({ borrador, tiposEvento }: ResumenReglaProps) {
  return (
    <HoverCard openDelay={100} closeDelay={150}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label="Resumen de la regla"
          className="relative flex size-9 cursor-default items-center justify-center rounded-lg border border-borde bg-superficie text-mod-workflows shadow-(--sombra-flotante) hover:bg-fila-hover"
        >
          <ListChecksIcon className="size-4" aria-hidden="true" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        sideOffset={8}
        // Solo fundido y un desplazamiento corto: sin zoom, que en un texto ancho se ve a saltos.
        className="w-96 max-w-[90vw] will-change-[transform,opacity] duration-200 ease-out data-open:zoom-in-100 data-closed:zoom-out-100 data-[side=bottom]:slide-in-from-top-1"
      >
        <TextoResumen borrador={borrador} tiposEvento={tiposEvento} />
      </HoverCardContent>
    </HoverCard>
  )
}

/** El mismo texto, sin ícono: para el panel del disparador. */
export function ResumenReglaCompleto({ borrador, tiposEvento }: ResumenReglaProps) {
  return (
    <div className="rounded-lg bg-sup-workflows p-3">
      <TextoResumen borrador={borrador} tiposEvento={tiposEvento} />
    </div>
  )
}
