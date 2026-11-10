import { HexColorInput, HexColorPicker } from 'react-colorful'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { normalizarHex } from '@/modules/academico/utils'

const COLOR_INICIAL = '#175cd3'

interface SelectorColorProps {
  /** Color #rrggbb, o null para el automático. */
  valor: string | null
  onChange: (valor: string | null) => void
}

export function SelectorColor({ valor, onChange }: SelectorColorProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" className="w-fit justify-start" aria-label="Elegir color">
          <span
            className="size-4 rounded-full border border-borde bg-fila-hover"
            style={valor ? { backgroundColor: valor } : undefined}
          />
          {valor ?? 'Automático'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-64 flex-col gap-3" align="start">
        <HexColorPicker
          color={valor ?? COLOR_INICIAL}
          onChange={(nuevo) => onChange(normalizarHex(nuevo))}
          className="w-full!"
        />
        <div className="flex items-center gap-2">
          <HexColorInput
            prefixed
            color={valor ?? COLOR_INICIAL}
            onChange={(nuevo) => {
              const hex = normalizarHex(nuevo)
              if (hex) onChange(hex)
            }}
            aria-label="Color en hexadecimal"
            className="h-9 w-full rounded-lg border border-borde bg-superficie px-3 text-sm text-texto uppercase outline-none focus-visible:border-violeta"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
            disabled={valor === null}
          >
            Automático
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
