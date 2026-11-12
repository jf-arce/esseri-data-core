import { EllipsisVerticalIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
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
          <SelectTrigger className="w-24" aria-labelledby={id} aria-busy={cargando}>
            <SelectValue placeholder={mostrarCarga ? <Skeleton className="h-3.5 w-10" /> : ''} />
          </SelectTrigger>
          <SelectContent className="min-w-24 p-1">
            {opciones.map((opcion) => (
              <SelectItem key={opcion.value} value={opcion.value} className="py-1.5 pr-6">
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

export function AccionesDivision({
  deshabilitado,
  puedeDarDeBaja,
  onAgregar,
  onDarDeBaja,
}: {
  deshabilitado: boolean
  puedeDarDeBaja: boolean
  onAgregar: () => void
  onDarDeBaja: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Acciones de la división"
          disabled={deshabilitado}
        >
          <EllipsisVerticalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={onAgregar}>
          <PlusIcon />
          Agregar división
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!puedeDarDeBaja} onSelect={onDarDeBaja}>
          <Trash2Icon />
          Dar de baja división actual
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
