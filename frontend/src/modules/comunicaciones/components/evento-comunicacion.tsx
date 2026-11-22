import { useId, useState } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { ApiError } from '@/api/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { editarEventoPublicado } from '../services/editar-comunicacion'
import type { Comunicacion, EventoBorrador } from '../types'

const EVENTO_VACIO: EventoBorrador = {
  titulo: '',
  fecha: null,
  hora_inicio: null,
  hora_fin: null,
  lugar: '',
  descripcion: '',
}

const CAMPOS = [
  { clave: 'titulo', etiqueta: 'Título del evento', tipo: 'text', requerido: true },
  { clave: 'fecha', etiqueta: 'Fecha', tipo: 'date', requerido: true },
  { clave: 'hora_inicio', etiqueta: 'Hora de inicio', tipo: 'time', requerido: false },
  { clave: 'hora_fin', etiqueta: 'Hora de fin', tipo: 'time', requerido: false },
  { clave: 'lugar', etiqueta: 'Lugar', tipo: 'text', requerido: false },
] as const

export function EventoComunicacion({
  evento,
  disabled,
  onChange,
  soloEdicion = false,
}: {
  evento: EventoBorrador | null | undefined
  disabled: boolean
  onChange: (evento: EventoBorrador | null) => void
  soloEdicion?: boolean
}) {
  const id = useId()
  const [abierto, setAbierto] = useState(Boolean(evento))
  return (
    <Collapsible
      open={!!evento && (soloEdicion || abierto)}
      onOpenChange={setAbierto}
      className={soloEdicion ? undefined : 'rounded-lg border border-borde'}
    >
      {!soloEdicion && (
        <div className="flex items-center gap-3 px-3 py-2">
          <Checkbox
            id={`${id}-activo`}
            checked={!!evento}
            disabled={disabled}
            onCheckedChange={(checked) => {
              setAbierto(checked === true)
              onChange(checked === true ? { ...EVENTO_VACIO } : null)
            }}
          />
          <FieldLabel htmlFor={`${id}-activo`} className="min-w-0 flex-1">
            Agregar evento al calendario del Portal Familia
          </FieldLabel>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled || !evento}
              aria-label={
                abierto && evento ? 'Contraer campos del evento' : 'Expandir campos del evento'
              }
            >
              <ChevronDownIcon
                aria-hidden="true"
                className={abierto && evento ? 'rotate-180' : ''}
              />
            </Button>
          </CollapsibleTrigger>
        </div>
      )}
      {evento && (
        <CollapsibleContent className={soloEdicion ? undefined : 'border-t border-borde p-3'}>
          <FieldGroup className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2">
            {CAMPOS.map(({ clave, etiqueta, tipo, requerido }) => (
              <Field key={clave} className="min-w-0">
                <FieldLabel htmlFor={`${id}-${clave}`}>{etiqueta}</FieldLabel>
                <Input
                  id={`${id}-${clave}`}
                  type={tipo}
                  maxLength={tipo === 'text' ? 200 : undefined}
                  required={requerido}
                  disabled={disabled}
                  value={evento[clave] ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...evento,
                      [clave]: tipo === 'text' ? e.target.value : e.target.value || null,
                    })
                  }
                />
              </Field>
            ))}
            <Field className="@xl/main:col-span-2">
              <FieldLabel htmlFor={`${id}-descripcion`}>Descripción opcional</FieldLabel>
              <Textarea
                id={`${id}-descripcion`}
                rows={2}
                maxLength={2000}
                disabled={disabled}
                value={evento.descripcion}
                onChange={(e) => onChange({ ...evento, descripcion: e.target.value })}
              />
            </Field>
          </FieldGroup>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}

export function EditarEventoPublicadoDialog({
  id,
  version,
  original,
  onCerrar,
  onGuardado,
}: {
  id: string
  version: number
  original: EventoBorrador
  onCerrar: () => void
  onGuardado: (comunicacion: Comunicacion) => void
}) {
  const [evento, setEvento] = useState(original)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const hayCambios = JSON.stringify(original) !== JSON.stringify(evento)

  return (
    <Dialog
      open
      onOpenChange={(abierto) => {
        if (!abierto && !guardando) onCerrar()
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar evento vinculado</DialogTitle>
          <DialogDescription>
            Los cambios se reflejan en el calendario del Portal Familia sin reenviar correos.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            if (guardando || !hayCambios) return
            setGuardando(true)
            setError('')
            try {
              onGuardado(await editarEventoPublicado(id, version, evento))
            } catch (causa) {
              setError(
                causa instanceof ApiError && causa.detail
                  ? causa.detail
                  : 'No se pudo guardar el evento.',
              )
              setGuardando(false)
            }
          }}
        >
          {error && (
            <Alert variant="error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <EventoComunicacion
            evento={evento}
            disabled={guardando}
            soloEdicion
            onChange={(nuevo) => {
              if (nuevo) setEvento(nuevo)
            }}
          />
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={guardando} onClick={onCerrar}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={guardando || !evento.titulo.trim() || !evento.fecha || !hayCambios}
            >
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
