import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { pedirBorradorComunicacion } from '@/modules/ia-sugerencias/services/pedir-borrador-comunicacion'
import type { Sugerencia } from '@/modules/ia-sugerencias/types'
import { MAX_INSTRUCCIONES, validarPedidoBorrador } from '@/modules/ia-sugerencias/utils'
import { listarTiposEvento } from '@/modules/workflows/services/listar-tipos-evento'
import type { TipoEvento } from '@/modules/workflows/types'
import { etiquetaEvento } from '@/modules/workflows/utils'

interface RedactarComunicacionDialogProps {
  onOpenChange: (open: boolean) => void
  onCreada: (sugerencia: Sugerencia) => void
}

/** Le pide al proveedor de IA un borrador de plantilla para un evento (#50). El borrador queda
 * pendiente de revisión en la bandeja: aprobarlo crea la plantilla, no envía nada. */
export function RedactarComunicacionDialog({
  onOpenChange,
  onCreada,
}: RedactarComunicacionDialogProps) {
  const [eventos, setEventos] = useState<TipoEvento[]>([])
  const [tipoEventoId, setTipoEventoId] = useState('')
  const [nombre, setNombre] = useState('')
  const [instrucciones, setInstrucciones] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [redactando, setRedactando] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    listarTiposEvento(controller.signal)
      .then(setEventos)
      .catch((causa: unknown) => {
        if (causa instanceof DOMException && causa.name === 'AbortError') return
        setError(causa instanceof ApiError ? causa.detail : 'No se pudieron cargar los eventos.')
      })
    return () => controller.abort()
  }, [])

  const evento = useMemo(() => eventos.find((e) => e.id === tipoEventoId), [eventos, tipoEventoId])

  async function redactar() {
    const pedido = { tipo_evento_id: tipoEventoId, nombre, instrucciones }
    const invalido = validarPedidoBorrador(pedido)
    if (invalido) {
      setError(invalido)
      return
    }
    setRedactando(true)
    setError(null)
    try {
      onCreada(
        await pedirBorradorComunicacion({
          ...pedido,
          nombre: nombre.trim(),
          instrucciones: instrucciones.trim(),
        }),
      )
      onOpenChange(false)
    } catch (causa) {
      setError(causa instanceof ApiError ? causa.detail : 'No se pudo redactar el borrador.')
    } finally {
      setRedactando(false)
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => !redactando && onOpenChange(abierto)}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto sm:!max-w-xl">
        <DialogHeader>
          <DialogTitle>Redactar comunicación con IA</DialogTitle>
          <DialogDescription>
            La IA redacta una plantilla para el evento con sus datos variables. Queda pendiente de
            revisión: al aprobarla se crea la plantilla, no se envía nada.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        <FieldGroup>
          <Field>
            <FieldLabel>Evento</FieldLabel>
            <Select value={tipoEventoId} onValueChange={setTipoEventoId}>
              <SelectTrigger aria-label="Evento">
                <SelectValue placeholder="Elegí el evento" />
              </SelectTrigger>
              <SelectContent>
                {eventos.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {etiquetaEvento(item.nombre)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {evento && evento.campos.length > 0 && (
              <FieldDescription>
                Datos que puede usar: {evento.campos.map((campo) => campo.etiqueta).join(', ')}.
              </FieldDescription>
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="borrador-nombre">Nombre de la plantilla</FieldLabel>
            <Input
              id="borrador-nombre"
              maxLength={150}
              placeholder="Ej.: Aviso cordial de cuota vencida"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="borrador-instrucciones">Qué tiene que decir</FieldLabel>
            <Textarea
              id="borrador-instrucciones"
              maxLength={MAX_INSTRUCCIONES}
              rows={4}
              placeholder="Ej.: Recordar con tono amable que la cuota venció y cómo regularizarla."
              value={instrucciones}
              onChange={(e) => setInstrucciones(e.target.value)}
            />
            <FieldDescription>
              No incluyas nombres ni datos de familias: la IA solo recibe esto y los datos variables
              del evento.
            </FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={redactando}>
            Cancelar
          </Button>
          <Button onClick={redactar} disabled={redactando}>
            {redactando && <Spinner data-icon="inline-start" />}
            {redactando ? 'Redactando…' : 'Redactar borrador'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
