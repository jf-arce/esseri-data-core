import { useEffect, useState } from 'react'
import { ChevronsUpDownIcon, PencilIcon } from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { CLASE_SELECT_ADAPTABLE } from '@/modules/workflows/constants'
import { buscarOpcionesCampo } from '@/modules/workflows/services/buscar-opciones-campo'
import type { OpcionCampo } from '@/modules/workflows/types'

const ESPERA_MS = 250

interface SelectorBuscableProps {
  campoId: string
  valor: string
  disabled: boolean
  /** Además de la lista se puede escribir un valor a mano ("otro"). */
  permiteOtro: boolean
  onChange: (valor: string) => void
}

/** Lista con buscador cuyos valores vienen del servidor (hay demasiados para traerlos todos). El
 * valor guardado es el texto exacto con el que el sistema arma el evento. */
export function SelectorBuscable({
  campoId,
  valor,
  disabled,
  permiteOtro,
  onChange,
}: SelectorBuscableProps) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<OpcionCampo[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(false)
  const [aMano, setAMano] = useState(false)

  useEffect(() => {
    if (!abierto) return
    const control = new AbortController()
    const espera = setTimeout(() => {
      setCargando(true)
      buscarOpcionesCampo(campoId, texto, control.signal)
        .then((opciones) => {
          setResultados(opciones)
          setError(false)
        })
        .catch(() => {
          if (!control.signal.aborted) setError(true)
        })
        .finally(() => {
          if (!control.signal.aborted) setCargando(false)
        })
    }, ESPERA_MS)
    return () => {
      clearTimeout(espera)
      control.abort()
    }
  }, [abierto, campoId, texto])

  if (aMano) {
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <Input
          aria-label="Valor"
          value={valor}
          disabled={disabled}
          className="min-w-0 bg-superficie"
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="w-fit text-xs text-texto-2 underline"
          onClick={() => {
            setAMano(false)
            onChange('')
          }}
        >
          Elegir de la lista
        </button>
      </div>
    )
  }

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-label="Valor"
          aria-expanded={abierto}
          disabled={disabled}
          // Mismo aspecto y tamaño que el resto de los desplegables de la condición.
          className={cn(
            CLASE_SELECT_ADAPTABLE,
            'flex cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-borde bg-superficie px-3 text-sm text-texto transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <span className={cn('line-clamp-2 break-words', valor === '' && 'text-desactivado')}>
            {valor === '' ? 'Buscar y elegir' : valor}
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar" value={texto} onValueChange={setTexto} />
          <CommandList>
            <CommandEmpty>
              {error ? 'No se pudo buscar.' : cargando ? 'Buscando…' : 'Sin resultados.'}
            </CommandEmpty>
            <CommandGroup>
              {resultados.map((opcion) => (
                <CommandItem
                  key={opcion.valor}
                  value={opcion.valor}
                  data-checked={opcion.valor === valor}
                  onSelect={() => {
                    onChange(opcion.valor)
                    setAbierto(false)
                  }}
                >
                  {opcion.etiqueta}
                </CommandItem>
              ))}
            </CommandGroup>
            {permiteOtro && (
              <CommandGroup>
                <CommandItem
                  value="__otro__"
                  onSelect={() => {
                    setAMano(true)
                    setAbierto(false)
                  }}
                >
                  <PencilIcon />
                  Otro (escribir a mano)
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
