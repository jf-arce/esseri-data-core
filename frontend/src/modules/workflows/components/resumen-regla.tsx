import { ListChecksIcon } from 'lucide-react'
import type { TipoEvento } from '@/modules/workflows/types'
import { fraseRegla, hijosDe, type BorradorFlujo } from '@/modules/workflows/utils-grafo'

interface ResumenReglaProps {
  borrador: BorradorFlujo
  tiposEvento: TipoEvento[]
}

/** La regla en una frase, para leerla sin recorrer el lienzo. */
export function ResumenRegla({ borrador, tiposEvento }: ResumenReglaProps) {
  // Una acción colgada del disparador no tiene condición: corre con cada evento.
  const hayAccionesSinCondicion = hijosDe(borrador.nodos, null).some((n) => n.tipo === 'accion')
  return (
    <div className="flex flex-col gap-1.5">
      <p
        aria-live="polite"
        className="flex items-start gap-2 rounded-card-sm bg-sup-workflows px-4 py-3 text-sm break-words text-texto"
      >
        <ListChecksIcon className="mt-0.5 size-4 shrink-0 text-mod-workflows" aria-hidden="true" />
        <span className="min-w-0">{fraseRegla(borrador, tiposEvento)}</span>
      </p>
      {hayAccionesSinCondicion && (
        <p className="px-1 text-xs text-texto-2">
          Las acciones sin condición se ejecutan con cada evento de este tipo. Para limitarlas, poné
          una condición entre el disparador y la acción.
        </p>
      )}
    </div>
  )
}
