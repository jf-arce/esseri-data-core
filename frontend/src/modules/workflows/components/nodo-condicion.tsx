import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { ArrowLeftRightIcon } from 'lucide-react'
import {
  BotonSumar,
  TarjetaNodo,
  type AccionesNodo,
  type OpcionesAgregar,
  type SimulacionNodo,
} from '@/modules/workflows/components/nodo-base'
import type { CampoEvento } from '@/modules/workflows/types'
import { textoCondicion, type NodoEditor } from '@/modules/workflows/utils-grafo'

export interface DatosNodoCondicion extends OpcionesAgregar {
  [clave: string]: unknown
  acciones: AccionesNodo
  nodo: NodoEditor
  campos: CampoEvento[]
  seleccionado: boolean
  soloLectura: boolean
  incompleto?: string
  aviso?: string
  simulacion?: SimulacionNodo
}

// Sí y No siempre en el centro de la tarjeta; el texto (pr-5) llega hasta los tres puntos sin pisarlos.
const TOP_SI = 'calc(50% - 16px)'
const TOP_NO = 'calc(50% + 16px)'

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
      superficie="bg-advertencia-suave min-h-[128px]"
      acento="text-advertencia"
      contorno="outline-advertencia"
      seleccionado={data.seleccionado}
      incompleto={data.incompleto}
      acciones={data.acciones}
      aviso={data.aviso}
      margenAvisos="pr-5"
      simulacion={data.simulacion}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="size-3.5! border-0! bg-advertencia!"
      />
      <p className="pr-5 text-sm font-semibold text-texto">{resumen}</p>
      {adicionales > 0 && (
        <p className="mt-1.5 pr-5 text-xs text-texto-2">
          {`+ ${adicionales} ${adicionales === 1 ? 'comparación más' : 'comparaciones más'} (se cumplen ${
            nodo.logica === 'todas' ? 'todas' : 'alguna'
          })`}
        </p>
      )}
      <Handle
        id="si"
        type="source"
        position={Position.Right}
        style={{ top: TOP_SI }}
        className="size-3.5! border-0! bg-exito!"
      />
      <Handle
        id="no"
        type="source"
        position={Position.Right}
        style={{ top: TOP_NO }}
        className="size-3.5! border-0! bg-error!"
      />
      <div className="absolute -right-9" style={{ top: `calc(${TOP_SI} - 12px)` }}>
        <BotonSumar
          rama="si"
          ladoTooltip="top"
          etiqueta="Agregar a la salida Sí"
          deshabilitado={soloLectura}
          tiposAccion={data.tiposAccion}
          nombreEvento={data.nombreEvento}
          onAgregar={data.onAgregar}
        />
      </div>
      <div className="absolute -right-9" style={{ top: `calc(${TOP_NO} - 12px)` }}>
        <BotonSumar
          rama="no"
          etiqueta="Agregar a la salida No"
          deshabilitado={soloLectura}
          tiposAccion={data.tiposAccion}
          nombreEvento={data.nombreEvento}
          onAgregar={data.onAgregar}
        />
      </div>
      <span
        style={{ top: TOP_SI }}
        className="pointer-events-none absolute right-3 -translate-y-1/2 text-[10px] font-bold text-exito"
      >
        Sí
      </span>
      <span
        style={{ top: TOP_NO }}
        className="pointer-events-none absolute right-3 -translate-y-1/2 text-[10px] font-bold text-error"
      >
        No
      </span>
    </TarjetaNodo>
  )
}
