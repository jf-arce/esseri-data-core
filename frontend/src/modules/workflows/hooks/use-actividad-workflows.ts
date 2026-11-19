import { useCallback, useEffect, useRef, useState } from 'react'
import { INTERVALO_ACTIVIDAD_MS, ULTIMAS_EJECUCIONES } from '@/modules/workflows/constants'
import { listarEjecucionesWorkflow } from '@/modules/workflows/services/listar-ejecuciones-workflow'
import type { EjecucionWorkflow, EstadoEjecucion } from '@/modules/workflows/types'

/** Últimas ejecuciones, refrescadas cada `intervaloMs` (o por quien lo use, con `null`). El polling se pausa con la pestaña
 * oculta y, al volver a verla, se refresca de inmediato. `nuevas` trae los ids que aparecieron
 * en el último refresco, para animar su entrada. */
export function useActividadWorkflows(
  intervaloMs: number | null = INTERVALO_ACTIVIDAD_MS,
  estado?: EstadoEjecucion,
) {
  const [ejecuciones, setEjecuciones] = useState<EjecucionWorkflow[]>([])
  const [nuevas, setNuevas] = useState<ReadonlySet<string>>(new Set())
  const [actualizadoEn, setActualizadoEn] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const conocidas = useRef<Set<string> | null>(null)

  const refrescar = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const listado = await listarEjecucionesWorkflow(
          { pagina: 1, tamanioPagina: ULTIMAS_EJECUCIONES, estado },
          signal,
        )
        const ids = new Set(listado.items.map((item) => item.id))
        // La primera carga no anima: solo lo que llega después es "nuevo".
        const previas = conocidas.current
        setNuevas(previas === null ? new Set() : new Set([...ids].filter((id) => !previas.has(id))))
        conocidas.current = ids
        setEjecuciones(listado.items)
        setActualizadoEn(new Date())
        setError(null)
      } catch (causa) {
        if (causa instanceof DOMException && causa.name === 'AbortError') return
        setError('No se pudo actualizar la actividad.')
      }
    },
    [estado],
  )

  useEffect(() => {
    // Con otro filtro la lista es otra: nada de lo que llegue cuenta como "nuevo".
    conocidas.current = null
    const controller = new AbortController()
    // Con `null` no hay ciclo propio: quien lo usa llama a `refrescar` (carga solo al montar).
    if (intervaloMs === null) {
      void refrescar(controller.signal)
      return () => controller.abort()
    }
    const cada = intervaloMs
    let temporizador: ReturnType<typeof setInterval> | null = null

    function iniciar() {
      void refrescar(controller.signal)
      temporizador = setInterval(() => void refrescar(controller.signal), cada)
    }
    function detener() {
      if (temporizador !== null) clearInterval(temporizador)
      temporizador = null
    }
    function alCambiarVisibilidad() {
      if (document.hidden) detener()
      else if (temporizador === null) iniciar()
    }

    if (!document.hidden) iniciar()
    document.addEventListener('visibilitychange', alCambiarVisibilidad)
    return () => {
      controller.abort()
      detener()
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
    }
  }, [intervaloMs, refrescar])

  return { ejecuciones, nuevas, actualizadoEn, error, refrescar: () => refrescar() }
}
