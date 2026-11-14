import { DatePicker } from '@/components/date-picker'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { TipoDato } from '@/modules/workflows/types'

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
  tipoDato: TipoDato
  valor: string
  disabled: boolean
  onChange: (valor: string) => void
  className?: string
}

/** El valor de una comparación según el tipo del campo. El texto crece hacia abajo en vez de
 * desbordar: una fila que se agranda con lo que se escribe (sin saltos de línea). */
export function ValorComparacion({
  tipoDato,
  valor,
  disabled,
  onChange,
  className,
}: ValorComparacionProps) {
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
    return (
      <Input
        aria-label="Valor"
        type="number"
        value={valor}
        disabled={disabled}
        className={cn('min-w-0 bg-superficie', className)}
        onChange={(e) => onChange(e.target.value)}
      />
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
