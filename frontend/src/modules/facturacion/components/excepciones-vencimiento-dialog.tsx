import { useState } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { formatearFechaHora } from '@/lib/fechas'
import { useExcepcionesVencimiento } from '@/modules/facturacion/hooks/use-excepciones-vencimiento'
import { anularExcepcionVencimiento } from '@/modules/facturacion/services/anular-excepcion-vencimiento'
import { crearExcepcionVencimiento } from '@/modules/facturacion/services/crear-excepcion-vencimiento'
import { formatearFechaFactura } from '@/modules/facturacion/utils'

interface ExcepcionesVencimientoDialogProps {
  familiaId: string
  familiaNombre: string
  puedeOtorgar: boolean
  puedeAnular: boolean
  onOpenChange: (open: boolean) => void
}

/** Prórrogas de una familia: no se editan; una mal cargada se anula y se otorga otra. */
export function ExcepcionesVencimientoDialog({
  familiaId,
  familiaNombre,
  puedeOtorgar,
  puedeAnular,
  onOpenChange,
}: ExcepcionesVencimientoDialogProps) {
  const { excepciones, cargando, error, recargar } = useExcepcionesVencimiento(familiaId)
  const [fecha, setFecha] = useState('')
  const [motivo, setMotivo] = useState('')
  const [errorForm, setErrorForm] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [confirmando, setConfirmando] = useState<string | null>(null)

  async function otorgar() {
    if (!fecha || !motivo.trim()) {
      setErrorForm('Indicá la nueva fecha de vencimiento y el motivo.')
      return
    }
    setEnviando(true)
    setErrorForm(null)
    try {
      await crearExcepcionVencimiento(familiaId, {
        fecha_vencimiento_excepcional: fecha,
        motivo: motivo.trim(),
      })
      toast.success('Prórroga otorgada')
      setFecha('')
      setMotivo('')
      recargar()
    } catch (causa) {
      setErrorForm(causa instanceof ApiError ? causa.detail : 'No se pudo otorgar la prórroga.')
    } finally {
      setEnviando(false)
    }
  }

  async function anular(id: string) {
    try {
      await anularExcepcionVencimiento(id)
      toast.success('Prórroga anulada')
      recargar()
    } catch (causa) {
      toast.error(causa instanceof ApiError ? causa.detail : 'No se pudo anular la prórroga.')
    } finally {
      setConfirmando(null)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto sm:!max-w-2xl">
        <DialogHeader>
          <DialogTitle>Prórrogas de vencimiento</DialogTitle>
          <DialogDescription>
            {familiaNombre}. Mientras una prórroga esté vigente, las facturas de la familia vencen
            recién después de esa fecha.
          </DialogDescription>
        </DialogHeader>

        {puedeOtorgar && (
          <FieldGroup>
            {errorForm && (
              <p role="alert" className="text-sm text-error">
                {errorForm}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-[180px_1fr_auto] sm:items-end">
              <Field>
                <FieldLabel htmlFor="prorroga-fecha">Nueva fecha</FieldLabel>
                <Input
                  id="prorroga-fecha"
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="prorroga-motivo">Motivo</FieldLabel>
                <Input
                  id="prorroga-motivo"
                  maxLength={500}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </Field>
              <Button onClick={otorgar} disabled={enviando}>
                {enviando ? 'Guardando…' : 'Otorgar'}
              </Button>
            </div>
          </FieldGroup>
        )}

        {error && <p className="text-sm text-error">{error}</p>}
        {cargando ? (
          <p className="text-sm text-texto-3">Cargando prórrogas…</p>
        ) : excepciones.length === 0 && !error ? (
          <p className="text-sm text-texto-3">La familia no tiene prórrogas.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-borde">
            {excepciones.map((excepcion) => (
              <li key={excepcion.id} className="flex items-start justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium tabular-nums">
                      Hasta el {formatearFechaFactura(excepcion.fecha_vencimiento_excepcional)}
                    </span>
                    <Badge variant={excepcion.anulada_at ? 'neutro' : 'exito'}>
                      {excepcion.anulada_at ? 'Anulada' : 'Vigente'}
                    </Badge>
                  </div>
                  {excepcion.motivo && (
                    <span className="text-sm text-texto-2">{excepcion.motivo}</span>
                  )}
                  <span className="text-xs text-texto-3">
                    Otorgada el {formatearFechaHora(excepcion.created_at)}
                    {excepcion.anulada_at &&
                      ` · anulada el ${formatearFechaHora(excepcion.anulada_at)}`}
                  </span>
                </div>
                {puedeAnular &&
                  !excepcion.anulada_at &&
                  (confirmando === excepcion.id ? (
                    <div className="flex shrink-0 gap-1">
                      <Button variant="secondary" size="sm" onClick={() => setConfirmando(null)}>
                        Cancelar
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => anular(excepcion.id)}>
                        Confirmar anulación
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setConfirmando(excepcion.id)}
                    >
                      Anular
                    </Button>
                  ))}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
