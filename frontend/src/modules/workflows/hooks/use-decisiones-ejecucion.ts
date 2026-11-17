import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { aprobarEjecucionWorkflow } from '@/modules/workflows/services/aprobar-ejecucion-workflow'
import { rechazarEjecucionWorkflow } from '@/modules/workflows/services/rechazar-ejecucion-workflow'
import type { EjecucionWorkflow } from '@/modules/workflows/types'

/** Aprobar y rechazar ejecuciones pendientes. Un solo clic a la vez (el estado no alcanza para
 * frenar un segundo clic dentro del mismo render), con aviso al terminar. `onTerminar` se llama
 * siempre, para recargar la lista; `onResultado` solo si el backend respondió. */
export function useDecisionesEjecucion({
  onTerminar,
  onResultado,
}: {
  onTerminar: () => void
  onResultado?: (resultado: EjecucionWorkflow) => void
}) {
  const [decidiendoId, setDecidiendoId] = useState<string | null>(null)
  const [porRechazar, setPorRechazar] = useState<EjecucionWorkflow | null>(null)
  const enCurso = useRef(false)

  async function decidir(
    ejecucion: EjecucionWorkflow,
    pedir: () => Promise<EjecucionWorkflow>,
    avisar: (resultado: EjecucionWorkflow) => void,
    mensajeError: string,
  ) {
    if (enCurso.current) return
    enCurso.current = true
    setDecidiendoId(ejecucion.id)
    try {
      const resultado = await pedir()
      avisar(resultado)
      onResultado?.(resultado)
    } catch (causa) {
      toast.error(causa instanceof ApiError ? causa.detail : mensajeError)
    } finally {
      enCurso.current = false
      setDecidiendoId(null)
      setPorRechazar(null)
      onTerminar()
    }
  }

  function aprobar(ejecucion: EjecucionWorkflow) {
    return decidir(
      ejecucion,
      () => aprobarEjecucionWorkflow(ejecucion.id),
      (resultado) => {
        if (resultado.estado === 'exitoso') toast.success('La ejecución se aprobó y se completó.')
        else toast.error('La ejecución se aprobó, pero la acción falló.')
      },
      'No se pudo aprobar la ejecución.',
    )
  }

  function rechazar(motivo: string) {
    if (porRechazar === null) return
    return decidir(
      porRechazar,
      () => rechazarEjecucionWorkflow(porRechazar.id, motivo),
      () => toast.success('La ejecución se rechazó.'),
      'No se pudo rechazar la ejecución.',
    )
  }

  return { decidiendoId, porRechazar, setPorRechazar, aprobar, rechazar }
}
