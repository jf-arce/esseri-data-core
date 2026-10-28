import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { LIMITE_MOTIVO_RECHAZO } from '@/modules/workflows/constants'
import type { EjecucionWorkflow } from '@/modules/workflows/types'

interface RechazoEjecucionDialogProps {
  /** La ejecución que se quiere rechazar; con `null` el diálogo está cerrado. */
  ejecucion: EjecucionWorkflow | null
  enviando: boolean
  onConfirmar: (motivo: string) => void
  onCancelar: () => void
}

function FormularioRechazo({
  ejecucion,
  enviando,
  onConfirmar,
  onCancelar,
}: Omit<RechazoEjecucionDialogProps, 'ejecucion'> & { ejecucion: EjecucionWorkflow }) {
  const [motivo, setMotivo] = useState('')
  const motivoLimpio = motivo.trim()

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault()
        if (motivoLimpio !== '' && !enviando) onConfirmar(motivoLimpio)
      }}
    >
      <DialogHeader>
        <DialogTitle>Rechazar ejecución</DialogTitle>
        <DialogDescription>
          La regla “{ejecucion.workflow_rule_nombre}” no se va a ejecutar para este evento. El
          motivo queda en el detalle de la ejecución.
        </DialogDescription>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor="rechazo-motivo">Motivo</FieldLabel>
        <Textarea
          id="rechazo-motivo"
          value={motivo}
          maxLength={LIMITE_MOTIVO_RECHAZO}
          disabled={enviando}
          autoFocus
          onChange={(e) => setMotivo(e.target.value)}
        />
        <FieldDescription>
          {motivo.length} / {LIMITE_MOTIVO_RECHAZO}
        </FieldDescription>
      </Field>
      <DialogFooter>
        <Button type="button" variant="secondary" disabled={enviando} onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" variant="destructive" disabled={enviando || motivoLimpio === ''}>
          {enviando && <Spinner data-icon="inline-start" />}
          Rechazar
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Pide el motivo antes de rechazar: el backend lo exige y lo deja en el detalle de la ejecución. */
export function RechazoEjecucionDialog({
  ejecucion,
  enviando,
  onConfirmar,
  onCancelar,
}: RechazoEjecucionDialogProps) {
  return (
    <Dialog open={ejecucion !== null} onOpenChange={(abierto) => !abierto && onCancelar()}>
      <DialogContent className="sm:max-w-md">
        {ejecucion && (
          // `key` reinicia el formulario (y el motivo) con cada ejecución que se rechaza.
          <FormularioRechazo
            key={ejecucion.id}
            ejecucion={ejecucion}
            enviando={enviando}
            onConfirmar={onConfirmar}
            onCancelar={onCancelar}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
