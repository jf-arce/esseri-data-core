import { ShuffleIcon } from 'lucide-react'
import { HexColorInput, HexColorPicker } from 'react-colorful'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { BotonIcono } from '@/modules/academico/components/boton-icono'
import { hexAleatorio, normalizarHex } from '@/modules/academico/utils'

interface SelectorColorProps {
  /** Color #rrggbb. */
  valor: string
  onChange: (valor: string) => void
}

export function SelectorColor({ valor, onChange }: SelectorColorProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" className="w-fit justify-start" aria-label="Elegir color">
          <span
            className="size-4 rounded-full border border-borde"
            style={{ backgroundColor: valor }}
          />
          {valor}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-64 flex-col gap-3" align="start">
        <HexColorPicker
          color={valor}
          onChange={(nuevo) => {
            const hex = normalizarHex(nuevo)
            if (hex) onChange(hex)
          }}
          className="w-full!"
        />
        <div className="flex items-center gap-2">
          <HexColorInput
            prefixed
            color={valor}
            onChange={(nuevo) => {
              const hex = normalizarHex(nuevo)
              if (hex) onChange(hex)
            }}
            aria-label="Color en hexadecimal"
            className="h-9 w-full rounded-lg border border-borde bg-superficie px-3 text-sm text-texto uppercase outline-none focus-visible:border-violeta"
          />
          <BotonIcono
            etiqueta="Color al azar"
            variant="secondary"
            onClick={() => onChange(hexAleatorio())}
          >
            <ShuffleIcon />
          </BotonIcono>
        </div>
      </PopoverContent>
    </Popover>
  )
}
