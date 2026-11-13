import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Label } from '@/components/ui/label'
import type { LoteDebitoResumen } from '@/modules/facturacion/types'

const MOTIVOS = [
  'Archivo no enviado al banco',
  'El banco no procesó el archivo',
  'El banco rechazó el archivo completo',
  'Otro',
]

interface LiberarLoteDialogProps {
  open: boolean
  lote: LoteDebitoResumen | null
  onOpenChange: (open: boolean) => void
  onConfirm: (motivo: string) => Promise<void>
}

export function LiberarLoteDialog({ open, lote, onOpenChange, onConfirm }: LiberarLoteDialogProps) {
  const [motivo, setMotivo] = useState<string | null>(null)
  const [detalle, setDetalle] = useState('')
  const [confirmacion, setConfirmacion] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')

  if (!lote) return null

  function cambiarAbierto(abierto: boolean) {
    if (!abierto) {
      setMotivo(null)
      setDetalle('')
      setConfirmacion(false)
      setProcesando(false)
      setError('')
    }
    onOpenChange(abierto)
  }

  const motivoFinal = motivo === 'Otro' ? detalle.trim() : (motivo ?? '')
  const puedeLiberar = Boolean(motivoFinal) && confirmacion && !procesando

  async function liberar() {
    if (!puedeLiberar) return
    setProcesando(true)
    setError('')
    try {
      await onConfirm(motivoFinal)
      cambiarAbierto(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo liberar el lote.')
    } finally {
      setProcesando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={cambiarAbierto}>
      <DialogContent className="min-w-0 text-[13px] [&_.text-sm]:text-[13px] [&_.text-sm]:leading-[18px] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Liberar lote {lote.codigo}</DialogTitle>
          <DialogDescription>
            Las {lote.cantidad_facturas} facturas vuelven a «pendiente sin lote» y podrán incluirse
            en un lote nuevo. Solo corresponde si el archivo no se envió o el banco no lo procesó.
            No está disponible para lotes con resultados importados.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Field>
          <FieldLabel htmlFor="motivo-liberacion">Motivo</FieldLabel>
          <select
            id="motivo-liberacion"
            aria-label="Motivo"
            className="h-9 w-full rounded-lg border border-borde bg-superficie px-3 text-sm text-texto outline-none disabled:cursor-not-allowed disabled:opacity-50"
            value={motivo ?? ''}
            onChange={(evento) => {
              setMotivo(evento.target.value || null)
              setError('')
            }}
          >
            <option value="" disabled>
              Seleccioná un motivo
            </option>
            {MOTIVOS.map((opcion) => (
              <option key={opcion} value={opcion}>
                {opcion}
              </option>
            ))}
          </select>
        </Field>

        {motivo === 'Otro' && (
          <Field>
            <FieldLabel htmlFor="detalle-liberacion">Detalle del motivo</FieldLabel>
            <Input
              id="detalle-liberacion"
              value={detalle}
              onChange={(evento) => setDetalle(evento.target.value)}
              placeholder="Escribí el motivo"
            />
          </Field>
        )}

        <div className="flex items-start gap-2">
          <Checkbox
            id="confirmacion-liberacion"
            checked={confirmacion}
            onCheckedChange={(valor) => setConfirmacion(valor === true)}
          />
          <Label htmlFor="confirmacion-liberacion" className="text-sm font-normal text-texto">
            Confirmo que el banco no procesó este lote.
          </Label>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => cambiarAbierto(false)}>
            Cancelar
          </Button>
          <Button disabled={!puedeLiberar} onClick={() => void liberar()}>
            Liberar {lote.cantidad_facturas} facturas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
