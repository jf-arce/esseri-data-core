import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from '@xyflow/react'
import { XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DatosArista {
  [clave: string]: unknown
  /** Contexto de la salida: `si` verde, `no` rojo, sin rama violeta. */
  rama: 'si' | 'no' | null
  /** Sale del disparador hacia una acción sin condición: corre con cada evento. */
  siempre?: boolean
  /** Durante la simulación: la arista que el indicador está recorriendo ahora, la ya recorrida y
   * la que no se tomó. */
  simulacion?: 'activa' | 'recorrida' | 'tenue'
  soloLectura: boolean
  onDesconectar: () => void
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
      {data?.siempre && (
        <EdgeLabelRenderer>
          <span
            style={{
              transform: `translate(-50%, -50%) translate(${sourceX + (targetX - sourceX) * 0.3}px, ${sourceY + (targetY - sourceY) * 0.3}px)`,
            }}
            className="pointer-events-none absolute rounded-full bg-sup-workflows px-2 py-0.5 text-[11px] font-semibold text-mod-workflows"
          >
            Siempre
          </span>
        </EdgeLabelRenderer>
      )}
      {selected && !data?.soloLectura && (
        <EdgeLabelRenderer>
          <button
            type="button"
            aria-label="Desconectar bloque"
            title="Desconectar"
            onClick={data?.onDesconectar}
            style={{ transform: `translate(-50%, -50%) translate(${centroX}px, ${centroY}px)` }}
            className="nodrag nopan pointer-events-auto absolute flex size-6 items-center justify-center rounded-full border border-borde bg-superficie text-texto-2 shadow-card hover:text-error"
          >
            <XIcon className="size-3.5" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
