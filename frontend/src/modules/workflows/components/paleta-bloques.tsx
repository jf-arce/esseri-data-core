import type { DragEvent } from 'react'
import { ArrowLeftRightIcon, GripVerticalIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TipoAccion, TipoAccionCatalogo } from '@/modules/workflows/types'
import { ETIQUETA_ACCION } from '@/modules/workflows/utils'
import { estadoDeBloque, GRUPOS_ACCION } from '@/modules/workflows/utils-grafo'

/** Tipo MIME con el que la paleta pasa el bloque arrastrado al lienzo. */
export const MIME_BLOQUE = 'application/x-workflow-bloque'

interface PaletaBloquesProps {
  tiposAccion: TipoAccionCatalogo[]
  nombreEvento: string | null
  soloLectura: boolean
  /** Alta con un clic: el editor lo conecta a la salida seleccionada o lo deja suelto. */
  onAgregar: (que: 'condicion' | TipoAccion) => void
}

function Bloque({
  que,
  etiqueta,
  motivo,
  deshabilitado,
  icono,
  onAgregar,
}: {
  que: 'condicion' | TipoAccion
  etiqueta: string
  motivo: string | null
  deshabilitado: boolean
  icono?: React.ReactNode
  onAgregar: (que: 'condicion' | TipoAccion) => void
}) {
  function alArrastrar(evento: DragEvent<HTMLButtonElement>) {
    evento.dataTransfer.setData(MIME_BLOQUE, que)
    evento.dataTransfer.effectAllowed = 'move'
  }
  return (
    <li>
      <button
        type="button"
        draggable={!deshabilitado}
        disabled={deshabilitado}
        onDragStart={alArrastrar}
        onClick={() => onAgregar(que)}
        className={cn(
          'flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-medium text-texto transition-colors',
          deshabilitado ? 'cursor-not-allowed text-texto-3' : 'cursor-grab hover:bg-fila-hover',
        )}
      >
        {icono ?? <GripVerticalIcon className="size-4 shrink-0 text-texto-3" aria-hidden="true" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate">{etiqueta}</span>
          {motivo && <span className="block text-xs font-normal text-texto-3">{motivo}</span>}
        </span>
      </button>
    </li>
  )
}

/** Paleta lateral: las 15 acciones por dominio y la condición. Cada una en uno de tres estados:
 * disponible, "No permitida para este evento" o "Todavía no disponible". */
export function PaletaBloques({
  tiposAccion,
  nombreEvento,
  soloLectura,
  onAgregar,
}: PaletaBloquesProps) {
  return (
    <nav aria-label="Bloques" className="flex flex-col gap-3">
      <p className="text-xs text-texto-2">
        Arrastrá un bloque al lienzo o usá el + de cada salida.
      </p>
      <ul className="flex flex-col">
        <Bloque
          que="condicion"
          etiqueta="Condición"
          motivo={null}
          deshabilitado={soloLectura}
          icono={
            <ArrowLeftRightIcon className="size-4 shrink-0 text-advertencia" aria-hidden="true" />
          }
          onAgregar={onAgregar}
        />
      </ul>
      {GRUPOS_ACCION.map((grupo) => (
        <section key={grupo.titulo} aria-label={grupo.titulo}>
          <h3 className="mb-1 text-xs font-bold tracking-[.06em] text-texto-3 uppercase">
            {grupo.titulo}
          </h3>
          <ul className="flex flex-col">
            {grupo.acciones.map((tipo) => {
              const { estado, motivo } = estadoDeBloque(tipo, tiposAccion, nombreEvento)
              return (
                <Bloque
                  key={tipo}
                  que={tipo}
                  etiqueta={ETIQUETA_ACCION[tipo]}
                  motivo={motivo}
                  deshabilitado={soloLectura || estado !== 'disponible'}
                  onAgregar={onAgregar}
                />
              )
            })}
          </ul>
        </section>
      ))}
    </nav>
  )
}
