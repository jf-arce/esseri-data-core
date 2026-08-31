import { useState } from 'react'
import { AlertTriangleIcon, RotateCcwIcon, UserRoundXIcon } from 'lucide-react'
import { ApiError } from '@/api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import type { SolicitudAdmision } from '@/modules/inscripciones/types'

export type AccionExcepcionalAdmision = 'revertir' | 'desistir' | 'revocar_aprobacion'

interface AccionExcepcionalAdmisionDialogProps {
  accion: AccionExcepcionalAdmision
  solicitud: SolicitudAdmision
  onOpenChange: (open: boolean) => void
  onConfirmar: (accion: AccionExcepcionalAdmision, motivo: string) => Promise<void>
}

const contenido: Record<
  AccionExcepcionalAdmision,
  { titulo: string; descripcion: string; confirmar: string; destructiva: boolean }
> = {
  revertir: {
    titulo: 'Revertir última etapa',
    descripcion:
      'La solicitud volverá una sola etapa atrás. El recorrido realizado se conservará en el historial.',
    confirmar: 'Revertir etapa',
    destructiva: false,
  },
  desistir: {
    titulo: 'Registrar desistimiento',
    descripcion:
      'La familia dejará de continuar el proceso. La solicitud y su historial no se eliminarán.',
    confirmar: 'Registrar desistimiento',
    destructiva: true,
  },
  revocar_aprobacion: {
    titulo: 'Revocar aprobación',
    descripcion:
      'La solicitud volverá a Evaluación. La aprobación original seguirá visible en el historial.',
    confirmar: 'Revocar aprobación',
    destructiva: true,
  },
}

function mensajeError(error: unknown) {
  return error instanceof ApiError
    ? error.detail
    : 'No se pudo completar la acción. Intentá de nuevo.'
}

export function AccionExcepcionalAdmisionDialog({
  accion,
  solicitud,
  onOpenChange,
  onConfirmar,
}: AccionExcepcionalAdmisionDialogProps) {
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const datos = contenido[accion]
  const nombre = `${solicitud.aspirante.apellido}, ${solicitud.aspirante.nombre}`

  async function confirmar() {
    if (!motivo.trim()) return
    setEnviando(true)
    setError(null)
    try {
      await onConfirmar(accion, motivo)
      onOpenChange(false)
    } catch (error) {
      setError(mensajeError(error))
    } finally {
      setEnviando(false)
    }
  }

  const Icono = accion === 'revertir' ? RotateCcwIcon : UserRoundXIcon

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{datos.titulo}</DialogTitle>
          <DialogDescription>
            {datos.descripcion} Afecta a {nombre}.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="error">
            <AlertTriangleIcon />
            <AlertTitle>No se pudo completar la acción</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Field>
          <FieldLabel htmlFor="motivo-accion-admision">Motivo</FieldLabel>
          <Textarea
            id="motivo-accion-admision"
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            placeholder="Explicá brevemente por qué realizás esta acción."
            disabled={enviando}
          />
        </Field>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            variant={datos.destructiva ? 'destructive' : 'default'}
            onClick={confirmar}
            disabled={enviando || !motivo.trim()}
          >
            {enviando ? <Spinner data-icon="inline-start" /> : <Icono data-icon="inline-start" />}
            {datos.confirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
