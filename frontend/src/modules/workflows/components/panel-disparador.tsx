import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LIMITE_NOMBRE_REGLA } from '@/modules/workflows/constants'
import type { TipoEvento } from '@/modules/workflows/types'
import { etiquetaEvento } from '@/modules/workflows/utils'

interface PanelDisparadorProps {
  nombre: string
  tipoEventoId: string
  tiposEvento: TipoEvento[]
  deshabilitado: boolean
  onCambiarNombre: (nombre: string) => void
  onCambiarEvento: (tipoEventoId: string) => void
}

export function PanelDisparador({
  nombre,
  tipoEventoId,
  tiposEvento,
  deshabilitado,
  onCambiarNombre,
  onCambiarEvento,
}: PanelDisparadorProps) {
  const evento = tiposEvento.find((tipo) => tipo.id === tipoEventoId)
  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="regla-nombre">Nombre de la regla</FieldLabel>
        <Input
          id="regla-nombre"
          value={nombre}
          maxLength={LIMITE_NOMBRE_REGLA}
          disabled={deshabilitado}
          onChange={(e) => onCambiarNombre(e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="regla-evento">Cuándo se dispara</FieldLabel>
        <Select value={tipoEventoId} onValueChange={onCambiarEvento} disabled={deshabilitado}>
          <SelectTrigger id="regla-evento">
            <SelectValue placeholder="Elegir cuándo se dispara" />
          </SelectTrigger>
          <SelectContent>
            {tiposEvento.map((tipo) => (
              <SelectItem key={tipo.id} value={tipo.id}>
                {etiquetaEvento(tipo.nombre)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {evento?.descripcion && <FieldDescription>{evento.descripcion}</FieldDescription>}
      </Field>
    </div>
  )
}
