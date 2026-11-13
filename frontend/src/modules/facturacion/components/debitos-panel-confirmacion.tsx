import { CircleCheckIcon, ShieldAlertIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { ImportacionDebitosRead } from '@/modules/facturacion/types'
import { formatearMoneda } from '@/modules/facturacion/utils'

interface DebitosPanelConfirmacionProps {
  importacion: ImportacionDebitosRead
  revisionConfirmada: boolean
  confirmando: boolean
  onRevisionChange: (valor: boolean) => void
  onConfirmar: () => void
  onVerHistorial: () => void
}

export function DebitosPanelConfirmacion({
  importacion,
  revisionConfirmada,
  confirmando,
  onRevisionChange,
  onConfirmar,
  onVerHistorial,
}: DebitosPanelConfirmacionProps) {
  const { resumen, errores, puede_confirmar, estado } = importacion
  if (estado === 'confirmada') {
    return (
      <aside
        aria-label="Confirmación de la importación"
        className="min-w-0 w-full rounded-panel border border-borde bg-superficie p-5 shadow-card"
      >
        <Alert variant="success">
          <CircleCheckIcon />
          <AlertTitle>Pagos registrados</AlertTitle>
          <AlertDescription>
            Se registraron {resumen.cobrados.cantidad} pagos por{' '}
            {formatearMoneda(resumen.cobrados.importe)}. Los rechazos y errores no generaron pagos.
          </AlertDescription>
        </Alert>
        <Button variant="secondary" className="mt-4 w-full" onClick={onVerHistorial}>
          Ver historial de lotes
        </Button>
      </aside>
    )
  }

  const bloqueado =
    !puede_confirmar ||
    !revisionConfirmada ||
    confirmando ||
    errores.length > 0 ||
    resumen.errores.cantidad > 0

  return (
    <aside
      aria-label="Confirmación de la importación"
      className="min-w-0 w-full rounded-panel border border-borde bg-superficie p-5 shadow-card"
    >
      <Alert variant="advertencia">
        <ShieldAlertIcon />
        <AlertTitle>Vista previa: todavía no se registró ningún pago</AlertTitle>
        <AlertDescription>
          Al confirmar se registran solo los cobros informados.
        </AlertDescription>
      </Alert>

      <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-[13px]">
        <dt className="text-texto-2">Se registrarán pagos</dt>
        <dd className="text-right font-medium tabular-nums">{resumen.cobrados.cantidad}</dd>
        <dt className="text-texto-2">Importe a registrar</dt>
        <dd className="text-right font-medium tabular-nums">
          {formatearMoneda(resumen.cobrados.importe)}
        </dd>
        <dt className="text-texto-2">Quedan pendientes (rechazados)</dt>
        <dd className="text-right font-medium tabular-nums">{resumen.rechazados.cantidad}</dd>
        <dt className="text-texto-2">No se procesan (errores)</dt>
        <dd className="text-right font-medium tabular-nums">{resumen.errores.cantidad}</dd>
      </dl>

      {resumen.errores.cantidad > 0 && (
        <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-sm text-error">
          {resumen.errores.cantidad === 1
            ? '1 error bloquea la confirmación hasta corregirlo. No se registró ningún pago.'
            : `${resumen.errores.cantidad} errores bloquean la confirmación hasta corregirlos. No se registró ningún pago.`}
        </p>
      )}
      {errores.map((mensaje) => (
        <p key={mensaje} className="mt-2 text-sm text-error">
          {mensaje}
        </p>
      ))}

      <div className="mt-4 flex items-start gap-2">
        <Checkbox
          id="revision-confirmada"
          checked={revisionConfirmada}
          onCheckedChange={(valor) => onRevisionChange(valor === true)}
        />
        <Label htmlFor="revision-confirmada" className="text-sm font-normal text-texto">
          Revisé el resumen y el detalle de rechazados y errores.
        </Label>
      </div>

      <Button className="mt-4 w-full" disabled={bloqueado} onClick={onConfirmar}>
        Confirmar y registrar {resumen.cobrados.cantidad} pagos
      </Button>
      <p className="mt-2 text-xs leading-relaxed text-texto-2">
        Los errores no se aplican. Si una factura cambió de estado, no se registra ningún pago y
        volvés a revisar las incidencias.
      </p>
    </aside>
  )
}
