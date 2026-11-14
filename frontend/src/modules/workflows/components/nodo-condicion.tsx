import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { ArrowLeftRightIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BotonSumar,
  TarjetaNodo,
  type OpcionesAgregar,
  type SimulacionNodo,
} from '@/modules/workflows/components/nodo-base'
import type { CampoEvento, Operador } from '@/modules/workflows/types'
import { ETIQUETA_OPERADOR, OPERADORES_POR_TIPO_DATO } from '@/modules/workflows/utils'
import {
  cambiarCampoDeComparacion,
  textoCondicion,
  type ComparacionEditor,
  type NodoEditor,
} from '@/modules/workflows/utils-grafo'

export interface DatosNodoCondicion extends OpcionesAgregar {
  [clave: string]: unknown
  nodo: NodoEditor
  campos: CampoEvento[]
  seleccionado: boolean
  soloLectura: boolean
  incompleto?: string
  simulacion?: SimulacionNodo
  onCambiarComparacion: (comparacion: ComparacionEditor) => void
}

export type NodoCondicionFlujo = Node<DatosNodoCondicion, 'condicion'>

export function NodoCondicion({ data }: NodeProps<NodoCondicionFlujo>) {
  const { nodo, campos, soloLectura } = data
  const primera = nodo.comparaciones[0]
  const campo = campos.find((item) => item.nombre_interno === primera?.campo)
  const operadores = campo ? OPERADORES_POR_TIPO_DATO[campo.tipo_dato] : []
  const adicionales = nodo.comparaciones.length - 1

  return (
    <TarjetaNodo
      etiqueta="Condición"
      icono={<ArrowLeftRightIcon />}
      superficie="bg-advertencia-suave"
      acento="text-advertencia"
      contorno="outline-advertencia"
      seleccionado={data.seleccionado}
      incompleto={data.incompleto}
      simulacion={data.simulacion}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="size-2.5! border-0! bg-advertencia!"
      />
      {primera ? (
        <div className="nodrag nopan flex flex-col gap-1.5">
          <Select
            value={primera.campo}
            disabled={soloLectura}
            onValueChange={(nombre) =>
              data.onCambiarComparacion(
                cambiarCampoDeComparacion(
                  campos.find((item) => item.nombre_interno === nombre) ?? null,
                ),
              )
            }
          >
            <SelectTrigger size="sm" aria-label="Campo de la condición" className="bg-superficie">
              <SelectValue placeholder="Elegir campo" />
            </SelectTrigger>
            <SelectContent>
              {campos.map((item) => (
                <SelectItem key={item.id} value={item.nombre_interno}>
                  {item.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-[auto_1fr] gap-1.5">
            <Select
              value={primera.operador}
              disabled={soloLectura || !campo}
              onValueChange={(valor) => {
                const operador = operadores.find((item) => item === valor)
                if (operador) data.onCambiarComparacion({ ...primera, operador })
              }}
            >
              <SelectTrigger size="sm" aria-label="Operador" className="min-w-16 bg-superficie">
                <SelectValue placeholder="…" />
              </SelectTrigger>
              <SelectContent>
                {operadores.map((operador: Operador) => (
                  <SelectItem key={operador} value={operador}>
                    {ETIQUETA_OPERADOR[operador]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              aria-label="Valor de la condición"
              value={primera.valor}
              disabled={soloLectura || !campo}
              type={campo?.tipo_dato === 'numero' ? 'number' : 'text'}
              className="h-8 bg-superficie"
              onChange={(e) => data.onCambiarComparacion({ ...primera, valor: e.target.value })}
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-texto-2">{textoCondicion(nodo, campos)}</p>
      )}
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
        className="size-2.5! border-0! bg-exito!"
      />
      <Handle
        id="no"
        type="source"
        position={Position.Right}
        style={{ top: '72%' }}
        className="size-2.5! border-0! bg-error!"
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
