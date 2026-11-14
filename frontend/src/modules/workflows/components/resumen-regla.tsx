import { ListChecksIcon } from 'lucide-react'
import type { TipoEvento } from '@/modules/workflows/types'
import { fraseRegla, type BorradorFlujo } from '@/modules/workflows/utils-grafo'

interface ResumenReglaProps {
  borrador: BorradorFlujo
  tiposEvento: TipoEvento[]
}

/** La regla en una frase, para leerla sin recorrer el lienzo. */
export function ResumenRegla({ borrador, tiposEvento }: ResumenReglaProps) {
  return (
    <p
      aria-live="polite"
      className="flex items-start gap-2 rounded-card-sm bg-sup-workflows px-4 py-3 text-sm text-texto"
    >
      <ListChecksIcon className="mt-0.5 size-4 shrink-0 text-mod-workflows" aria-hidden="true" />
      <span>{fraseRegla(borrador, tiposEvento)}</span>
    </p>
  )
}
