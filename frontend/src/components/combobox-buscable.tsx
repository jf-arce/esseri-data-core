import { useState, type ReactElement } from 'react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { desplazarConRueda } from '@/lib/desplazar-con-rueda'

/** Opción de una lista de selección única con buscador (`ComboboxBuscable`). */
export interface OpcionCombo {
  valor: string
  etiqueta: string
  /** Texto secundario (p. ej. la categoría o el email) que también encuentra el buscador. */
  detalle?: string
  /** Las opciones con el mismo grupo se muestran juntas, bajo su título. */
  grupo?: string
}

interface ComboboxBuscableProps {
  opciones: OpcionCombo[]
  valor: string | null
  onElegir: (valor: string) => void
  /** El elemento que abre la lista (un botón). */
  children: ReactElement
  align?: 'start' | 'center' | 'end'
}

/** Lista de selección única con buscador. Se cierra al elegir. */
export function ComboboxBuscable({
  opciones,
  valor,
  onElegir,
  children,
  align = 'start',
}: ComboboxBuscableProps) {
  const [abierto, setAbierto] = useState(false)
  const grupos = new Map<string, OpcionCombo[]>()
  for (const opcion of opciones) {
    const clave = opcion.grupo ?? ''
    grupos.set(clave, [...(grupos.get(clave) ?? []), opcion])
  }

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Buscar" />
          <CommandList ref={desplazarConRueda}>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            {[...grupos].map(([titulo, items]) => (
              <CommandGroup key={titulo} heading={titulo === '' ? undefined : titulo}>
                {items.map((opcion) => (
                  <CommandItem
                    key={opcion.valor}
                    // cmdk exige valores únicos y filtra por este texto: incluye el detalle.
                    value={`${opcion.etiqueta} ${opcion.detalle ?? ''} ${opcion.valor}`}
                    data-checked={opcion.valor === valor}
                    onSelect={() => {
                      onElegir(opcion.valor)
                      setAbierto(false)
                    }}
                  >
                    <span className="flex flex-col">
                      {opcion.etiqueta}
                      {opcion.detalle && (
                        <span className="text-xs text-texto-3">{opcion.detalle}</span>
                      )}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
