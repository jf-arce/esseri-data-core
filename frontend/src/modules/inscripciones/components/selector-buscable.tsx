import { useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'

export interface SelectorBuscableOpcion {
  id: string
  titulo: string
  detalle: string
}

interface SelectorBuscableProps {
  id: string
  value: string
  opciones: SelectorBuscableOpcion[]
  placeholder: string
  buscarPlaceholder: string
  vacioMensaje: string
  cargando?: boolean
  disabled?: boolean
  invalid?: boolean
  onBuscar: (termino: string) => void
  onChange: (id: string) => void
}

export function SelectorBuscable({
  id,
  value,
  opciones,
  placeholder,
  buscarPlaceholder,
  vacioMensaje,
  cargando,
  disabled,
  invalid,
  onBuscar,
  onChange,
}: SelectorBuscableProps) {
  const [abierto, setAbierto] = useState(false)
  const seleccionada = opciones.find((opcion) => opcion.id === value)

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="secondary"
          role="combobox"
          aria-expanded={abierto}
          aria-invalid={invalid}
          disabled={disabled}
          className="h-9 w-full justify-between rounded-lg px-3 font-normal hover:bg-superficie"
        >
          <span className="truncate">{seleccionada?.titulo ?? placeholder}</span>
          <ChevronsUpDown data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder={buscarPlaceholder} onValueChange={onBuscar} />
          <CommandList>
            {cargando ? (
              <div className="flex flex-col gap-2 p-3" aria-label="Cargando opciones">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-3/4" />
              </div>
            ) : (
              <>
                <CommandEmpty>{vacioMensaje}</CommandEmpty>
                <CommandGroup>
                  {opciones.map((opcion) => (
                    <CommandItem
                      key={opcion.id}
                      value={opcion.id}
                      data-checked={opcion.id === value}
                      onSelect={() => {
                        onChange(opcion.id)
                        setAbierto(false)
                      }}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{opcion.titulo}</span>
                        <span className="truncate text-xs text-texto-2">{opcion.detalle}</span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
