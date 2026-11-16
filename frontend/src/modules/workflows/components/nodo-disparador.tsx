import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { ZapIcon } from 'lucide-react'
import {
  BotonSumar,
  TarjetaNodo,
  type AccionesNodo,
  type OpcionesAgregar,
} from '@/modules/workflows/components/nodo-base'
import { SALIDA_DISPARADOR } from '@/modules/workflows/utils-grafo'

export interface DatosNodoDisparador extends OpcionesAgregar {
  [clave: string]: unknown
  acciones: AccionesNodo
  titulo: string
  detalle: string
  incompleto?: string
  seleccionado: boolean
  soloLectura: boolean
  /** Lienzo vacío: el "+" es el siguiente paso, así que se resalta. */
  resaltarSalida: boolean
}

export type NodoDisparadorFlujo = Node<DatosNodoDisparador, 'disparador'>

export function NodoDisparador({ data }: NodeProps<NodoDisparadorFlujo>) {
  return (
    <TarjetaNodo
      etiqueta="Disparador"
      icono={<ZapIcon />}
      superficie="bg-sup-workflows"
      acento="text-mod-workflows"
      contorno="outline-mod-workflows"
      seleccionado={data.seleccionado}
      incompleto={data.incompleto}
      acciones={data.acciones}
    >
      <p className="line-clamp-3 text-sm font-semibold text-texto" title={data.titulo}>
        {data.titulo}
      </p>
      <p className="mt-0.5 line-clamp-3 text-xs text-texto-2" title={data.detalle}>
        {data.detalle}
      </p>
      <Handle
        id={SALIDA_DISPARADOR}
        type="source"
        position={Position.Right}
        className="size-3.5! border-0! bg-mod-workflows!"
      />
      <div className="absolute top-1/2 -right-10 -translate-y-1/2">
        <BotonSumar
          rama={null}
          etiqueta="Agregar el primer bloque"
          resaltado={data.resaltarSalida}
          deshabilitado={data.soloLectura}
          tiposAccion={data.tiposAccion}
          nombreEvento={data.nombreEvento}
          onAgregar={data.onAgregar}
        />
      </div>
    </TarjetaNodo>
  )
}
