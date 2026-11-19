import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface FiltroSelectProps {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  /** Con un valor distinto del "Todos" se resalta, igual que el resto de los filtros. */
  active?: boolean
}

/** Filtro de selección única como select: el disparador muestra "Etiqueta: valor elegido". */
export function FiltroSelect({ label, options, value, onChange, active }: FiltroSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        className={cn(
          'data-[size=default]:h-10 gap-1.5 pl-4 font-medium text-texto-2 hover:bg-fila-hover',
          active && 'border-violeta-borde bg-violeta-suave text-violeta hover:bg-violeta-suave',
        )}
      >
        <span>{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        position="popper"
        align="start"
        sideOffset={4}
        className="min-w-(--radix-select-trigger-width)"
      >
        {options.map((opcion) => (
          <SelectItem key={opcion.value} value={opcion.value}>
            {opcion.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
