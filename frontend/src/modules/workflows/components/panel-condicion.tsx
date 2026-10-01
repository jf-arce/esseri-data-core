import { DatePicker } from '@/components/date-picker'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Operador, TipoEvento } from '@/modules/workflows/types'
import {
  cambiarCampoCondicion,
  ETIQUETA_OPERADOR,
  OPERADORES_POR_TIPO_DATO,
  type ValoresRegla,
} from '@/modules/workflows/utils'

// Radix no admite `value=""` en un ítem: la opción "Sin condición" usa este valor.
const SIN_CONDICION = '__sin_condicion__'

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

interface PanelCondicionProps {
  valores: ValoresRegla
  evento: TipoEvento | undefined
  deshabilitado: boolean
  onCambiar: (valores: ValoresRegla) => void
}

export function PanelCondicion({ valores, evento, deshabilitado, onCambiar }: PanelCondicionProps) {
  const campos = evento?.campos ?? []
  const campo = campos.find((item) => item.nombre_interno === valores.campoCondicion)
  const operadores = campo ? OPERADORES_POR_TIPO_DATO[campo.tipo_dato] : []

  function cambiarOperador(valor: string) {
    const operador = operadores.find((item) => item === valor)
    if (operador) onCambiar({ ...valores, operadorCondicion: operador })
  }

  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="condicion-campo">Campo</FieldLabel>
        <Select
          value={valores.campoCondicion === '' ? SIN_CONDICION : valores.campoCondicion}
          disabled={deshabilitado || !evento}
          onValueChange={(nombre) =>
            onCambiar(
              cambiarCampoCondicion(
                valores,
                campos.find((item) => item.nombre_interno === nombre) ?? null,
              ),
            )
          }
        >
          <SelectTrigger id="condicion-campo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SIN_CONDICION}>Sin condición</SelectItem>
            {campos.map((item) => (
              <SelectItem key={item.id} value={item.nombre_interno}>
                {item.etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>
          {evento
            ? 'Sin condición, la regla se ejecuta con cada evento.'
            : 'Elegí primero el evento disparador.'}
        </FieldDescription>
      </Field>
      {campo && (
        <>
          <Field>
            <FieldLabel htmlFor="condicion-operador">Operador</FieldLabel>
            <Select
              value={valores.operadorCondicion}
              disabled={deshabilitado}
              onValueChange={cambiarOperador}
            >
              <SelectTrigger id="condicion-operador">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {operadores.map((operador: Operador) => (
                  <SelectItem key={operador} value={operador}>
                    {ETIQUETA_OPERADOR[operador]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="condicion-valor">Valor</FieldLabel>
            {campo.tipo_dato === 'fecha' ? (
              <DatePicker
                id="condicion-valor"
                value={aFechaLocal(valores.valorCondicion)}
                disabled={deshabilitado}
                onChange={(fecha) =>
                  onCambiar({ ...valores, valorCondicion: fecha ? aIso(fecha) : '' })
                }
              />
            ) : (
              <Input
                id="condicion-valor"
                type={campo.tipo_dato === 'numero' ? 'number' : 'text'}
                value={valores.valorCondicion}
                disabled={deshabilitado}
                onChange={(e) => onCambiar({ ...valores, valorCondicion: e.target.value })}
              />
            )}
          </Field>
        </>
      )}
    </div>
  )
}
