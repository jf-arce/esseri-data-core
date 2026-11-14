import { useMemo } from 'react'
import { Link } from 'react-router'
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { PlusIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RUTA_NUEVA_REGLA, rutaRegla } from '@/modules/workflows/constants'
import type { ReglaWorkflow, TipoEvento } from '@/modules/workflows/types'
import { etiquetaEvento } from '@/modules/workflows/utils'
import { agruparMapa } from '@/modules/workflows/utils-mapa'

const ANCHO_COLUMNA = 300
const ALTO_FILA = 76

interface DatosModulo extends Record<string, unknown> {
  titulo: string
}
interface DatosEvento extends Record<string, unknown> {
  titulo: string
  eventoId: string
  sinReglas: boolean
  puedeCrear: boolean
}
interface DatosRegla extends Record<string, unknown> {
  regla: ReglaWorkflow
}

type NodoModulo = Node<DatosModulo, 'modulo'>
type NodoEvento = Node<DatosEvento, 'evento'>
type NodoRegla = Node<DatosRegla, 'regla'>
type NodoMapa = NodoModulo | NodoEvento | NodoRegla

const ESTILO_HANDLE = 'size-2! border-0! bg-borde!'

function NodoDeModulo({ data }: NodeProps<NodoModulo>) {
  return (
    <div className="w-56 rounded-card-sm bg-sup-workflows px-4 py-3 shadow-card">
      <p className="text-xs font-bold tracking-[.06em] text-mod-workflows uppercase">Módulo</p>
      <p className="text-sm font-semibold text-texto">{data.titulo}</p>
      <Handle type="source" position={Position.Right} className={ESTILO_HANDLE} />
    </div>
  )
}

function NodoDeEvento({ data }: NodeProps<NodoEvento>) {
  return (
    <div
      className={cn(
        'w-60 rounded-card-sm bg-superficie px-4 py-3 shadow-card transition-opacity',
        data.sinReglas && 'opacity-60',
      )}
    >
      <Handle type="target" position={Position.Left} className={ESTILO_HANDLE} />
      <p className="text-sm font-medium text-texto">{data.titulo}</p>
      {data.sinReglas && (
        <p className="mt-1 flex items-center justify-between gap-2 text-xs text-texto-2">
          Sin automatizar
          {data.puedeCrear && (
            <Link
              to={`${RUTA_NUEVA_REGLA}?evento=${data.eventoId}`}
              className="nodrag nopan inline-flex min-h-8 items-center gap-1 rounded-md px-2 font-semibold text-violeta hover:bg-violeta-suave"
            >
              <PlusIcon className="size-3.5" aria-hidden="true" />
              Crear regla
            </Link>
          )}
        </p>
      )}
      <Handle type="source" position={Position.Right} className={ESTILO_HANDLE} />
    </div>
  )
}

function NodoDeRegla({ data }: NodeProps<NodoRegla>) {
  const { regla } = data
  return (
    <div
      className={cn(
        'w-60 rounded-card-sm bg-sup-inscripciones px-4 py-3 shadow-card',
        !regla.activo && 'bg-fila-hover',
      )}
    >
      <Handle type="target" position={Position.Left} className={ESTILO_HANDLE} />
      <Link
        to={rutaRegla(regla.id)}
        className="nodrag nopan block truncate text-sm font-semibold text-texto hover:underline"
        title={regla.nombre}
      >
        {regla.nombre}
      </Link>
      <p className="text-xs text-texto-2">{regla.activo ? 'Activa' : 'Inactiva'}</p>
    </div>
  )
}

const TIPOS_NODO: NodeTypes = { modulo: NodoDeModulo, evento: NodoDeEvento, regla: NodoDeRegla }

/** Lienzo de solo lectura: Módulo → Evento → Regla. Un evento sin reglas se ve atenuado con un
 * "+ Crear regla"; las aristas de una regla inactiva van en gris. */
export default function MapaAutomatizaciones({
  tiposEvento,
  reglas,
  puedeCrear,
}: {
  tiposEvento: TipoEvento[]
  reglas: ReglaWorkflow[]
  puedeCrear: boolean
}) {
  const { nodos, aristas } = useMemo(() => {
    const nodos: NodoMapa[] = []
    const aristas: Edge[] = []
    let fila = 0
    for (const { modulo, eventos } of agruparMapa(tiposEvento, reglas)) {
      const filasEventos: number[] = []
      for (const { evento, reglas: delEvento } of eventos) {
        const filasReglas: number[] = []
        for (const regla of delEvento) {
          nodos.push({
            id: `regla-${regla.id}`,
            type: 'regla',
            position: { x: ANCHO_COLUMNA * 2, y: fila * ALTO_FILA },
            data: { regla },
          })
          aristas.push({
            id: `a-${evento.id}-${regla.id}`,
            source: `evento-${evento.id}`,
            target: `regla-${regla.id}`,
            style: {
              stroke: regla.activo ? 'var(--mod-workflows)' : 'var(--borde-fuerte, var(--texto-3))',
              strokeWidth: 1.5,
              opacity: regla.activo ? 1 : 0.6,
            },
          })
          filasReglas.push(fila)
          fila += 1
        }
        const filaEvento = filasReglas.length > 0 ? mediaDe(filasReglas) : fila
        if (filasReglas.length === 0) fila += 1
        nodos.push({
          id: `evento-${evento.id}`,
          type: 'evento',
          position: { x: ANCHO_COLUMNA, y: filaEvento * ALTO_FILA },
          data: {
            titulo: etiquetaEvento(evento.nombre),
            eventoId: evento.id,
            sinReglas: delEvento.length === 0,
            puedeCrear,
          },
        })
        aristas.push({
          id: `a-${modulo}-${evento.id}`,
          source: `modulo-${modulo}`,
          target: `evento-${evento.id}`,
          style: { stroke: 'var(--borde)', strokeWidth: 1.5 },
        })
        filasEventos.push(filaEvento)
      }
      nodos.push({
        id: `modulo-${modulo}`,
        type: 'modulo',
        position: { x: 0, y: mediaDe(filasEventos) * ALTO_FILA },
        data: { titulo: modulo },
      })
    }
    return { nodos, aristas }
  }, [tiposEvento, reglas, puedeCrear])

  return (
    <div className="h-[min(720px,75vh)] min-h-[420px] w-full rounded-panel bg-superficie shadow-card">
      <ReactFlow<NodoMapa>
        nodes={nodos}
        edges={aristas}
        nodeTypes={TIPOS_NODO}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        minZoom={0.2}
        proOptions={{ hideAttribution: true }}
        aria-label="Mapa de automatizaciones"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="var(--borde)" />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
    </div>
  )
}

function mediaDe(valores: number[]): number {
  return valores.reduce((suma, valor) => suma + valor, 0) / valores.length
}
