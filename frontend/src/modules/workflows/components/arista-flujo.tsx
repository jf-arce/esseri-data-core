import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from '@xyflow/react'
import { PlusIcon, XIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { PASO_MS } from '@/modules/workflows/hooks/use-simulacion-regla'

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
  const simulacion = data?.simulacion
  const tenue = simulacion === 'tenue'
  const activa = simulacion === 'activa'
  const recorrida = simulacion === 'recorrida'
  return (
    <>
      {/* El `pathLength` normalizado deja que el dibujo al conectar (stroke-dashoffset) dure lo
          mismo sin importar el largo de la arista. Durante la simulación la arista queda fija:
          el movimiento lo hace la capa de arriba, así no se reinicia el dibujo en cada paso. */}
      <BaseEdge
        id={id}
        path={trayecto}
        pathLength={1}
        interactionWidth={24}
        className={cn(
          simulacion === undefined && 'arista-dibujar',
          'transition-opacity duration-200',
        )}
        style={{
          stroke: color,
          strokeWidth: selected || activa || recorrida ? 2.5 : 1.75,
          opacity: tenue ? 0.25 : 1,
          filter: recorrida ? `drop-shadow(0 0 3px ${color})` : undefined,
        }}
      />
      {activa && (
        <g aria-hidden="true" className="arista-viaje-capa">
          <path
            d={trayecto}
            pathLength={1}
            fill="none"
            stroke={color}
            strokeWidth={4}
            className="arista-viaje"
            style={{
              animationDuration: `${PASO_MS}ms`,
              filter: `drop-shadow(0 0 5px ${color})`,
            }}
          />
          <circle r={5} fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }}>
            <animateMotion dur={`${PASO_MS}ms`} path={trayecto} fill="freeze" />
          </circle>
        </g>
      )}
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Agregar condición"
                    onClick={data?.onInsertarCondicion}
                    className="flex size-6 items-center justify-center rounded-full border border-borde bg-superficie text-texto-2 shadow-card hover:text-texto"
                  >
                    <PlusIcon className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={2}>
                  Agregar condición
                </TooltipContent>
              </Tooltip>
              {selected && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="Desconectar bloque"
                      onClick={data?.onDesconectar}
                      className="flex size-6 items-center justify-center rounded-full border border-borde bg-superficie text-texto-2 shadow-card hover:text-error"
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={2}>
                    Desconectar
                  </TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
