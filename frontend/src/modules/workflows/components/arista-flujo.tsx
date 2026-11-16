import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from '@xyflow/react'
import { PlusIcon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DatosArista {
  [clave: string]: unknown
  /** Contexto de la salida: `si` verde, `no` rojo, sin rama violeta. */
  rama: 'si' | 'no' | null
  /** Cómo se lee el paso ("Siempre", "Entonces", "Si no, pero si"…), según origen y destino. */
  etiqueta: string
  /** Durante la simulación: la arista que el indicador está recorriendo ahora, la ya recorrida y
   * la que no se tomó. */
  simulacion?: 'activa' | 'recorrida' | 'tenue'
  soloLectura: boolean
  onDesconectar: () => void
  /** Mete una condición entre el origen y el destino de esta conexión. */
  onInsertarCondicion: () => void
}

export type AristaFlujo = Edge<DatosArista, 'flujo'>

const COLOR: Record<'si' | 'no' | 'neutra', string> = {
  si: 'var(--exito)',
  no: 'var(--error)',
  neutra: 'var(--mod-workflows)',
}

export function AristaFlujo({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps<AristaFlujo>) {
  const [trayecto, centroX, centroY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })
  const color = COLOR[data?.rama ?? 'neutra']
  const tenue = data?.simulacion === 'tenue'
  return (
    <>
      {/* El `pathLength` normalizado deja que el dibujo al conectar (stroke-dashoffset) dure lo
          mismo sin importar el largo de la arista. */}
      <BaseEdge
        id={id}
        path={trayecto}
        pathLength={1}
        interactionWidth={24}
        className={cn(
          data?.simulacion === 'activa' ? 'arista-recorrido' : 'arista-dibujar',
          'transition-opacity duration-200',
        )}
        style={{
          stroke: color,
          strokeWidth: selected || data?.simulacion === 'activa' ? 2.5 : 1.75,
          opacity: tenue ? 0.25 : 1,
        }}
      />
      {data?.etiqueta && (
        <EdgeLabelRenderer>
          <span
            style={{
              transform: `translate(-50%, -50%) translate(${centroX}px, ${centroY}px)`,
              color,
              borderColor: color,
            }}
            className="pointer-events-none absolute rounded-full border bg-superficie px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
          >
            {data.etiqueta}
          </span>
        </EdgeLabelRenderer>
      )}
      {!data?.soloLectura && (
        <EdgeLabelRenderer>
          <div
            style={{
              transform: `translate(-50%, 0) translate(${centroX}px, ${centroY + 16}px)`,
            }}
            className="nodrag nopan pointer-events-auto absolute flex items-center gap-1"
          >
            <button
              type="button"
              aria-label="Insertar una condición"
              title="Insertar una condición"
              onClick={data?.onInsertarCondicion}
              className="flex size-6 items-center justify-center rounded-full border border-borde bg-superficie text-texto-2 shadow-card hover:text-texto"
            >
              <PlusIcon className="size-3.5" />
            </button>
            {selected && (
              <button
                type="button"
                aria-label="Desconectar bloque"
                title="Desconectar"
                onClick={data?.onDesconectar}
                className="flex size-6 items-center justify-center rounded-full border border-borde bg-superficie text-texto-2 shadow-card hover:text-error"
              >
                <XIcon className="size-3.5" />
              </button>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
