import { DatePicker } from '@/components/date-picker'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CLASE_SELECT_ADAPTABLE } from '@/modules/workflows/constants'
import type { CampoEvento } from '@/modules/workflows/types'
import { esNumeroValido } from '@/modules/workflows/utils'

function aFechaLocal(iso: string): Date | undefined {
  const [anio, mes, dia] = iso.split('-').map(Number)
  if (!anio || !mes || !dia) return undefined
  return new Date(anio, mes - 1, dia)
}

function aIso(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

interface ValorComparacionProps {
  campo: CampoEvento
  valor: string
  disabled: boolean
  onChange: (valor: string) => void
  className?: string
}

/** El valor de una comparación según el tipo del campo. El texto crece hacia abajo en vez de
 * desbordar: una fila que se agranda con lo que se escribe (sin saltos de línea). */
export function ValorComparacion({
  campo,
  valor,
  disabled,
  onChange,
  className,
}: ValorComparacionProps) {
  const { tipo_dato: tipoDato, opciones } = campo
  if (opciones !== null) {
    return (
      <Select value={valor} disabled={disabled} onValueChange={onChange}>
        <SelectTrigger aria-label="Valor" className={cn(CLASE_SELECT_ADAPTABLE, 'bg-superficie')}>
          <SelectValue placeholder="Elegir valor" />
        </SelectTrigger>
        <SelectContent>
          {opciones.map((opcion) => (
            <SelectItem key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
  if (tipoDato === 'fecha') {
    return (
      <DatePicker
        value={aFechaLocal(valor)}
        disabled={disabled}
        onChange={(fecha) => onChange(fecha ? aIso(fecha) : '')}
      />
    )
  }
  if (tipoDato === 'numero') {
    const invalido = valor.trim() !== '' && !esNumeroValido(valor)
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <Input
          aria-label="Valor"
          inputMode="decimal"
          value={valor}
          disabled={disabled}
          aria-invalid={invalido}
          className={cn('min-w-0 bg-superficie', className)}
          onChange={(e) => onChange(e.target.value.replace(',', '.'))}
        />
        {invalido && <p className="text-xs text-error">El valor tiene que ser un número</p>}
      </div>
    )
  }
  return (
    <Textarea
      aria-label="Valor"
      rows={1}
      value={valor}
      disabled={disabled}
      className={cn(
        'field-sizing-content min-h-9 min-w-0 resize-none bg-superficie py-1.5 break-words',
        className,
      )}
      onChange={(e) => onChange(e.target.value.replace(/\s*\n\s*/g, ' '))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.preventDefault()
      }}
    />
  )
}
