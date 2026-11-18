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
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { LIMITE_NOMBRE_REGLA } from '@/modules/workflows/constants'
import type { ReglaWorkflow } from '@/modules/workflows/types'

interface RenombrarReglaDialogProps {
  /** La regla que se quiere renombrar; con `null` el diálogo está cerrado. */
  regla: ReglaWorkflow | null
  enviando: boolean
  onConfirmar: (nombre: string) => void
  onCancelar: () => void
}

function FormularioRenombrar({
  regla,
  enviando,
  onConfirmar,
  onCancelar,
}: Omit<RenombrarReglaDialogProps, 'regla'> & { regla: ReglaWorkflow }) {
  const [nombre, setNombre] = useState(regla.nombre)
  const limpio = nombre.trim()
  const sinCambios = limpio === regla.nombre

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault()
        if (limpio !== '' && !sinCambios && !enviando) onConfirmar(limpio)
      }}
    >
      <DialogHeader>
        <DialogTitle>Renombrar regla</DialogTitle>
        <DialogDescription>El flujo y las acciones de la regla no cambian.</DialogDescription>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor="renombrar-regla-nombre">Nombre</FieldLabel>
        <Input
          id="renombrar-regla-nombre"
          value={nombre}
          maxLength={LIMITE_NOMBRE_REGLA}
          disabled={enviando}
          autoFocus
          onFocus={(evento) => evento.currentTarget.select()}
          onChange={(e) => setNombre(e.target.value)}
        />
      </Field>
      <DialogFooter>
        <Button type="button" variant="secondary" disabled={enviando} onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={enviando || limpio === '' || sinCambios}>
          {enviando && <Spinner data-icon="inline-start" />}
          Guardar
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Cambia solo el nombre de la regla, sin abrir el editor. */
export function RenombrarReglaDialog({
  regla,
  enviando,
  onConfirmar,
  onCancelar,
}: RenombrarReglaDialogProps) {
  return (
    <Dialog open={regla !== null} onOpenChange={(abierto) => !abierto && onCancelar()}>
      <DialogContent className="sm:max-w-md">
        {regla && (
          // `key` reinicia el campo con cada regla que se renombra.
          <FormularioRenombrar
            key={regla.id}
            regla={regla}
            enviando={enviando}
            onConfirmar={onConfirmar}
            onCancelar={onCancelar}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
