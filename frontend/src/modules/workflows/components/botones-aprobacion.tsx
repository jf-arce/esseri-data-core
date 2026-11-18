import { CheckIcon, XIcon } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { BotonIcono } from '@/modules/workflows/components/boton-icono'
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
    <div className="flex items-center gap-2">
      <BotonIcono
        etiqueta="Aprobar"
        lado="top"
        variant="ghost"
        size="icon-sm"
        className="bg-exito-suave text-exito hover:bg-[color-mix(in_oklch,var(--exito)_15%,var(--exito-suave))] hover:text-exito"
        disabled={ocupado}
        onClick={() => onAprobar(ejecucion)}
      >
        {decidiendo ? <Spinner /> : <CheckIcon />}
      </BotonIcono>
      <BotonIcono
        etiqueta="Rechazar"
        lado="top"
        variant="destructive"
        size="icon-sm"
        disabled={ocupado}
        onClick={() => onRechazar(ejecucion)}
      >
        <XIcon />
      </BotonIcono>
    </div>
  )
}
