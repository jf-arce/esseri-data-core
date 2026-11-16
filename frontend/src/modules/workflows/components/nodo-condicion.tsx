import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { ArrowLeftRightIcon } from 'lucide-react'
import {
  BotonSumar,
  TarjetaNodo,
  type OpcionesAgregar,
  type SimulacionNodo,
} from '@/modules/workflows/components/nodo-base'
import type { CampoEvento } from '@/modules/workflows/types'
import { textoCondicion, type NodoEditor } from '@/modules/workflows/utils-grafo'

export interface DatosNodoCondicion extends OpcionesAgregar {
  [clave: string]: unknown
  nodo: NodoEditor
  campos: CampoEvento[]
  seleccionado: boolean
  soloLectura: boolean
  incompleto?: string
  aviso?: string
  simulacion?: SimulacionNodo
}

export type NodoCondicionFlujo = Node<DatosNodoCondicion, 'condicion'>

export function NodoCondicion({ data }: NodeProps<NodoCondicionFlujo>) {
  const { nodo, campos, soloLectura } = data
  const adicionales = nodo.comparaciones.length - 1
  // Solo la primera comparación: el resto se resume en "+ N más" y se edita en el panel.
  const resumen = textoCondicion({ ...nodo, comparaciones: nodo.comparaciones.slice(0, 1) }, campos)

  return (
    <TarjetaNodo
      etiqueta="Condición"
      icono={<ArrowLeftRightIcon />}
      superficie="bg-advertencia-suave"
      acento="text-advertencia"
      contorno="outline-advertencia"
      seleccionado={data.seleccionado}
      incompleto={data.incompleto}
      aviso={data.aviso}
      simulacion={data.simulacion}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="size-3.5! border-0! bg-advertencia!"
      />
      <p className="line-clamp-3 text-sm font-semibold text-texto" title={resumen}>
        {resumen}
      </p>
      {adicionales > 0 && (
        <p className="mt-1.5 text-xs text-texto-2">
          {`+ ${adicionales} ${adicionales === 1 ? 'comparación más' : 'comparaciones más'} (se cumplen ${
            nodo.logica === 'todas' ? 'todas' : 'alguna'
          })`}
        </p>
      )}
      <Handle
        id="si"
        type="source"
        position={Position.Right}
        style={{ top: '34%' }}
        className="size-3.5! border-0! bg-exito!"
      />
      <Handle
        id="no"
        type="source"
        position={Position.Right}
        style={{ top: '72%' }}
        className="size-3.5! border-0! bg-error!"
      />
      <div className="absolute -right-9" style={{ top: 'calc(34% - 12px)' }}>
        <BotonSumar
          rama="si"
          etiqueta="Agregar a la salida Sí"
          deshabilitado={soloLectura}
          tiposAccion={data.tiposAccion}
          nombreEvento={data.nombreEvento}
          onAgregar={data.onAgregar}
        />
      </div>
      <div className="absolute -right-9" style={{ top: 'calc(72% - 12px)' }}>
        <BotonSumar
          rama="no"
          etiqueta="Agregar a la salida No"
          deshabilitado={soloLectura}
          tiposAccion={data.tiposAccion}
          nombreEvento={data.nombreEvento}
          onAgregar={data.onAgregar}
        />
      </div>
      <span className="pointer-events-none absolute top-[34%] right-2.5 -translate-y-1/2 text-[10px] font-bold text-exito">
        Sí
      </span>
      <span className="pointer-events-none absolute top-[72%] right-2.5 -translate-y-1/2 text-[10px] font-bold text-error">
        No
      </span>
    </TarjetaNodo>
  )
}
