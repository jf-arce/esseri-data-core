import { useState } from 'react'
import { ListChecksIcon, TriangleAlertIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TipoEvento } from '@/modules/workflows/types'
import { fraseRegla, hijosDe, type BorradorFlujo } from '@/modules/workflows/utils-grafo'

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

/** La regla en una frase, para leerla sin recorrer el lienzo. Es un chip de una línea sobre el
 * lienzo; un clic lo expande. */
export function ResumenRegla({ borrador, tiposEvento }: ResumenReglaProps) {
  const [expandido, setExpandido] = useState(false)
  const aviso = haySinCondicion(borrador)
  return (
    <div className="flex max-w-full flex-col items-start gap-1.5">
      <button
        type="button"
        aria-expanded={expandido}
        aria-live="polite"
        title={expandido ? 'Contraer el resumen' : 'Ver el resumen completo'}
        onClick={() => setExpandido((actual) => !actual)}
        className="flex max-w-full cursor-pointer items-start gap-2 rounded-card-sm bg-sup-workflows px-3 py-1.5 text-left text-sm text-texto shadow-card"
      >
        <ListChecksIcon className="mt-0.5 size-4 shrink-0 text-mod-workflows" aria-hidden="true" />
        <span className={cn('min-w-0', expandido ? 'break-words' : 'truncate')}>
          {fraseRegla(borrador, tiposEvento)}
        </span>
        {aviso && (
          <TriangleAlertIcon
            className="mt-0.5 size-4 shrink-0 text-advertencia"
            role="img"
            aria-label="Hay acciones sin condición"
          />
        )}
      </button>
      {expandido && aviso && (
        <p className="rounded-card-sm bg-superficie px-3 py-1.5 text-xs text-texto-2 shadow-card">
          {NOTA_SIN_CONDICION}
        </p>
      )}
    </div>
  )
}

/** La misma frase y la misma nota, sin chip: para el panel del disparador. */
export function ResumenReglaCompleto({ borrador, tiposEvento }: ResumenReglaProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-sup-workflows p-3">
      <p className="text-sm break-words text-texto">{fraseRegla(borrador, tiposEvento)}</p>
      {haySinCondicion(borrador) && <p className="text-xs text-texto-2">{NOTA_SIN_CONDICION}</p>}
    </div>
  )
}
