import type { LucideIcon } from 'lucide-react'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function SelectorComunicacion<T extends string>({
  id,
  etiqueta,
  valor,
  opciones,
  titulos,
  descripciones,
  iconos,
  disabled,
  onChange,
}: {
  id: string
  etiqueta: string
  valor: T
  opciones: readonly T[]
  titulos: Record<T, string>
  descripciones: Record<T, string>
  iconos?: Partial<Record<T, LucideIcon>>
  disabled: boolean
  onChange: (valor: T) => void
}) {
  return (
    <Field className="min-w-0">
      <FieldLabel htmlFor={id}>{etiqueta}</FieldLabel>
      <Select
        value={valor}
        disabled={disabled}
        onValueChange={(value) => {
          const opcion = opciones.find((opcion) => opcion === value)
          if (opcion) onChange(opcion)
        }}
      >
        <SelectTrigger id={id} className="w-full focus-visible:border-violeta">
          <SelectValue>{titulos[valor]}</SelectValue>
        </SelectTrigger>
        <SelectContent position="popper" align="start" className="w-(--radix-select-trigger-width)">
          <SelectGroup>
            {opciones.map((opcion) => {
              const Icono = iconos?.[opcion]
              return (
                <SelectItem key={opcion} value={opcion} textValue={titulos[opcion]}>
                  {Icono && <Icono aria-hidden="true" className="text-violeta" />}
                  <span className="min-w-0">
                    <span className="block font-semibold">{titulos[opcion]}</span>
                    <span className="block text-xs text-texto-2">{descripciones[opcion]}</span>
                  </span>
                </SelectItem>
              )
            })}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}
