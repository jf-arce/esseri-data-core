import { useEffect, useState } from 'react'
import { obtenerEstadisticasRegla } from '@/modules/workflows/services/obtener-estadisticas-regla'
import type { EstadisticasNodo } from '@/modules/workflows/types'

/** Ejecuciones por nodo de una regla guardada. Sin `reglaId` (borrador nuevo) no pide nada.
 * Si falla, el editor sigue sin contadores: son informativos. */
export function useEstadisticasRegla(reglaId: string | undefined) {
  const [resultado, setResultado] = useState<{
    reglaId: string | undefined
    porNodo: Map<string, EstadisticasNodo>
  }>({ reglaId: undefined, porNodo: new Map() })

  useEffect(() => {
    if (reglaId === undefined) return
    const controller = new AbortController()
    obtenerEstadisticasRegla(reglaId, undefined, controller.signal)
      .then((datos) =>
        setResultado({
          reglaId,
          porNodo: new Map(datos.nodos.map((nodo) => [nodo.workflow_nodo_id, nodo])),
        }),
      )
      .catch(() => {})
    return () => controller.abort()
  }, [reglaId])

  return resultado.reglaId === reglaId ? resultado.porNodo : new Map<string, EstadisticasNodo>()
}
