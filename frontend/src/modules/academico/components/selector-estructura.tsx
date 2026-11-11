import { PencilIcon, PlusIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { BotonIcono } from '@/modules/academico/components/boton-icono'
import { useIndicadorCarga } from '@/modules/academico/hooks/use-indicador-carga'

export type OpcionSelector = { value: string; label: string }

// Desplegable con etiqueta y botones al lado; mientras carga se queda en su lugar.
export function SelectorEstructura({
  etiqueta,
  valor,
  opciones,
  cargando,
  onCambio,
  children,
}: {
  etiqueta: string
  valor?: string
  opciones: OpcionSelector[]
  cargando: boolean
  onCambio: (valor: string) => void
  children?: ReactNode
}) {
  const id = `etiqueta-${etiqueta.toLowerCase()}`
  const mostrarCarga = useIndicadorCarga(cargando)
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-xs font-semibold text-texto-2">
        {etiqueta}
      </span>
      <div className="flex items-center gap-1">
        <Select value={cargando ? '' : valor} onValueChange={onCambio} disabled={cargando}>
          <SelectTrigger className="w-20" aria-labelledby={id} aria-busy={cargando}>
            <SelectValue placeholder={mostrarCarga ? <Skeleton className="h-3.5 w-10" /> : ''} />
          </SelectTrigger>
          <SelectContent>
            {opciones.map((opcion) => (
              <SelectItem key={opcion.value} value={opcion.value}>
                {opcion.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {children}
      </div>
    </div>
  )
}

export function AccionesSelector({
  nombre,
  deshabilitado,
  onAgregar,
  onEditar,
}: {
  nombre: 'año' | 'división'
  deshabilitado: boolean
  onAgregar: () => void
  onEditar: () => void
}) {
  return (
    <>
      <BotonIcono etiqueta={`Agregar ${nombre}`} disabled={deshabilitado} onClick={onAgregar}>
        <PlusIcon />
      </BotonIcono>
      <BotonIcono etiqueta={`Editar ${nombre}`} disabled={deshabilitado} onClick={onEditar}>
        <PencilIcon />
      </BotonIcono>
    </>
  )
}
