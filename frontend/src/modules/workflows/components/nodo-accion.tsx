import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { LockIcon, SendIcon } from 'lucide-react'
import { Link } from 'react-router'
import { TarjetaNodo, type SimulacionNodo } from '@/modules/workflows/components/nodo-base'
import { RUTA_EJECUCIONES } from '@/modules/workflows/constants'
import type { EstadisticasNodo } from '@/modules/workflows/types'
import { ETIQUETA_ACCION } from '@/modules/workflows/utils'
import { textoContadores, type NodoEditor } from '@/modules/workflows/utils-grafo'

export interface DatosNodoAccion {
  [clave: string]: unknown
  nodo: NodoEditor
  /** Línea secundaria: plantilla, destinatarios, etc. */
  detalle: string
  seleccionado: boolean
  incompleto?: string
  simulacion?: SimulacionNodo
  /** Solo en acciones ya guardadas de una regla guardada. */
  estadisticas?: EstadisticasNodo
  reglaId?: string
  dias: number
}

export type NodoAccionFlujo = Node<DatosNodoAccion, 'accion'>

export function NodoAccion({ data }: NodeProps<NodoAccionFlujo>) {
  const { nodo } = data
  return (
    <TarjetaNodo
      etiqueta="Acción"
      icono={<SendIcon />}
      superficie="bg-sup-inscripciones"
      acento="text-mod-inscripciones"
      contorno="outline-mod-inscripciones"
      seleccionado={data.seleccionado}
      incompleto={data.incompleto}
      simulacion={data.simulacion}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="size-2.5! border-0! bg-mod-inscripciones!"
      />
      <p className="flex items-center gap-1.5 text-sm font-semibold text-texto">
        {nodo.tipoAccion ? ETIQUETA_ACCION[nodo.tipoAccion] : 'Sin acción'}
        {nodo.requiereAprobacionHumana && (
          <LockIcon className="size-3.5 text-advertencia" aria-label="Requiere aprobación humana" />
        )}
      </p>
      {data.detalle && <p className="mt-0.5 truncate text-xs text-texto-2">{data.detalle}</p>}
      {data.estadisticas && data.reglaId && (
        <Link
          to={`${RUTA_EJECUCIONES}?regla=${data.reglaId}&nodo=${nodo.id}`}
          className="nodrag nopan mt-1.5 block text-xs font-medium text-violeta hover:underline"
          title={`Ejecuciones de los últimos ${data.dias} días`}
        >
          {textoContadores(data.estadisticas)}, {data.dias} días
        </Link>
      )}
    </TarjetaNodo>
  )
}
