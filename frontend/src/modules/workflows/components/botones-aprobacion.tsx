import { CheckIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { EjecucionWorkflow } from '@/modules/workflows/types'

interface BotonesAprobacionProps {
  ejecucion: EjecucionWorkflow
  /** Aprobar y rechazar exigen `workflows.actualizar`, igual que el backend. */
  puedeActualizar: boolean
  /** Id de la ejecución que se está decidiendo: mientras tanto no se puede decidir otra. */
  decidiendoId: string | null
  onAprobar: (ejecucion: EjecucionWorkflow) => void
  onRechazar: (ejecucion: EjecucionWorkflow) => void
}

/** Aprobar y rechazar una ejecución pendiente. Solo se muestran cuando el backend la marca
 * `aprobable` (pendiente, regla activa y sin cambios desde que quedó esperando). */
export function BotonesAprobacion({
  ejecucion,
  puedeActualizar,
  decidiendoId,
  onAprobar,
  onRechazar,
}: BotonesAprobacionProps) {
  if (!ejecucion.aprobable || !puedeActualizar) return null
  const decidiendo = decidiendoId === ejecucion.id
  const ocupado = decidiendoId !== null
  return (
    <>
      <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => onAprobar(ejecucion)}>
        {decidiendo ? <Spinner data-icon="inline-start" /> : <CheckIcon data-icon="inline-start" />}
        Aprobar
      </Button>
      <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => onRechazar(ejecucion)}>
        <XIcon data-icon="inline-start" />
        Rechazar
      </Button>
    </>
  )
}
