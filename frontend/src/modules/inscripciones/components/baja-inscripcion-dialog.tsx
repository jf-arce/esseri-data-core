import { useState } from 'react'
import { UserRoundMinusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { DatePicker } from '@/components/date-picker'
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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { registrarBajaInscripcion } from '@/modules/inscripciones/services/registrar-baja-inscripcion'
import type { InscripcionListadoItem } from '@/modules/inscripciones/types'
import { fechaParaApi } from '@/modules/inscripciones/utils'

interface BajaInscripcionDialogProps {
  inscripcion: InscripcionListadoItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRegistrada: () => void
}

function mensajeError(error: unknown) {
  if (error instanceof ApiError) return error.detail
  return 'No pudimos registrar la baja. Revisá tu conexión e intentá de nuevo.'
}

export function BajaInscripcionDialog({
  inscripcion,
  open,
  onOpenChange,
  onRegistrada,
}: BajaInscripcionDialogProps) {
  const [fechaBaja, setFechaBaja] = useState<Date | undefined>(new Date())
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirmarBaja() {
    if (!inscripcion || !fechaBaja) return

    setEnviando(true)
    setError(null)
    try {
      await registrarBajaInscripcion(inscripcion.id, { fecha_baja: fechaParaApi(fechaBaja) })
      toast.success('Baja registrada correctamente.')
      onOpenChange(false)
      onRegistrada()
    } catch (error) {
      setError(mensajeError(error))
    } finally {
      setEnviando(false)
    }
  }

  const nombreAlumno = inscripcion
    ? `${inscripcion.alumno_apellido}, ${inscripcion.alumno_nombre}`
    : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar baja de inscripción</DialogTitle>
          <DialogDescription>
            Vas a dar de baja a {nombreAlumno}. La inscripción no se elimina: quedará registrada en
            el historial y el alumno pasará a estado inactivo.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="error">
            <AlertTitle>No se pudo registrar la baja</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="fecha-baja">Fecha de la baja</FieldLabel>
            <DatePicker
              id="fecha-baja"
              value={fechaBaja}
              onChange={setFechaBaja}
              disabled={enviando}
              invalid={!fechaBaja}
              className="w-full"
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmarBaja} disabled={!fechaBaja || enviando}>
            {enviando ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <UserRoundMinusIcon data-icon="inline-start" />
            )}
            Registrar baja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
