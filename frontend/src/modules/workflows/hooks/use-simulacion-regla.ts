import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '@/api/client'
import type { SimulacionNodo } from '@/modules/workflows/components/nodo-base'
import { simularRegla } from '@/modules/workflows/services/simular-regla'
import type { Simulacion, TipoAccionCatalogo, TipoEvento } from '@/modules/workflows/types'
import {
  hayErrores,
  hijosDe,
  payloadDesdeBorrador,
  validarBorrador,
  type BorradorFlujo,
} from '@/modules/workflows/utils-grafo'

/** Pausa entre un bloque y el siguiente del recorrido animado. */
export const PASO_MS = 650

/** Estado de nodo con el que la simulación no llegó. */
const NO_ALCANZADO = 'no_alcanzado'

function reducirMovimiento(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Lo que cuenta como cambio del borrador para dar por vieja una simulación: todo menos las
 * posiciones, que no afectan lo que la regla hace. */
function firmaDe(borrador: BorradorFlujo): string {
  return JSON.stringify([
    borrador.tipoEventoId,
    borrador.nodos.map((nodo) => ({ ...nodo, posicion: null })),
  ])
}

/** Ids de los nodos que el recorrido alcanzó, en el orden en que se ven: de arriba hacia abajo,
 * primero la salida Sí y después la No. */
export function ordenDeRecorrido(
  borrador: BorradorFlujo,
  estados: ReadonlyMap<string, string>,
): string[] {
  const orden: string[] = []
  function visitar(padreId: string | null) {
    for (const rama of padreId === null ? [null] : (['si', 'no'] as const)) {
      for (const hijo of hijosDe(borrador.nodos, padreId, rama)) {
        if (estados.get(hijo.id) === NO_ALCANZADO) continue
        orden.push(hijo.id)
        if (hijo.tipo === 'condicion') visitar(hijo.id)
      }
    }
  }
  visitar(null)
  return orden
}

interface Resultado {
  simulacion: Simulacion
  firma: string
  orden: string[]
}

export function useSimulacionRegla(
  borrador: BorradorFlujo,
  tiposAccion: TipoAccionCatalogo[],
  evento: TipoEvento | undefined,
) {
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [paso, setPaso] = useState(0)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const peticion = useRef<AbortController | null>(null)

  const firmaActual = useMemo(() => firmaDe(borrador), [borrador])
  const desactualizada = resultado !== null && resultado.firma !== firmaActual

  const simular = useCallback(
    async (eventoId: string) => {
      if (hayErrores(validarBorrador(borrador, tiposAccion, evento?.campos))) {
        setError('Completá los bloques marcados como incompletos antes de probar la regla.')
        return
      }
      peticion.current?.abort()
      const controller = new AbortController()
      peticion.current = controller
      setCargando(true)
      setError(null)
      try {
        const payload = payloadDesdeBorrador(borrador, tiposAccion, evento)
        const simulacion = await simularRegla(
          { tipo_evento_id: payload.tipo_evento_id, event_log_id: eventoId, nodos: payload.nodos },
          controller.signal,
        )
        const estados = new Map(simulacion.nodos.map((nodo) => [nodo.id, nodo.estado]))
        const orden = ordenDeRecorrido(borrador, estados)
        setResultado({ simulacion, firma: firmaDe(borrador), orden })
        setPaso(reducirMovimiento() ? orden.length + 1 : 0)
      } catch (causa) {
        if (causa instanceof DOMException && causa.name === 'AbortError') return
        setError(causa instanceof ApiError ? causa.detail : 'No se pudo probar la regla.')
      } finally {
        if (peticion.current === controller) setCargando(false)
      }
    },
    [borrador, evento, tiposAccion],
  )

  const limpiar = useCallback(() => {
    peticion.current?.abort()
    setResultado(null)
    setPaso(0)
    setError(null)
    setCargando(false)
  }, [])

  // Un nodo por vez: el indicador "recorre" el flujo. Al terminar se muestra lo no alcanzado.
  const total = resultado?.orden.length ?? 0
  useEffect(() => {
    if (resultado === null || desactualizada || paso > total) return
    const temporizador = setTimeout(() => setPaso((actual) => actual + 1), PASO_MS)
    return () => clearTimeout(temporizador)
  }, [resultado, desactualizada, paso, total])

  const visible = resultado !== null && !desactualizada
  const nodos = useMemo<ReadonlyMap<string, SimulacionNodo> | null>(() => {
    if (!visible || resultado === null) return null
    const alcanzados = new Set(resultado.orden)
    return new Map(
      resultado.simulacion.nodos.map((nodo) => {
        const indice = resultado.orden.indexOf(nodo.id)
        const yaToca = alcanzados.has(nodo.id) ? indice < paso : paso > total
        return [nodo.id, { estado: nodo.estado, detalle: nodo.detalle, visible: yaToca }]
      }),
    )
  }, [visible, resultado, paso, total])

  const aristas = useMemo<ReadonlyMap<string, 'activa' | 'recorrida' | 'tenue'> | null>(() => {
    if (!visible || resultado === null) return null
    const mapa = new Map<string, 'activa' | 'recorrida' | 'tenue'>()
    resultado.orden.forEach((id, indice) => {
      if (indice < paso - 1) mapa.set(id, 'recorrida')
      else if (indice === paso - 1) mapa.set(id, paso > total ? 'recorrida' : 'activa')
    })
    if (paso > total) {
      for (const nodo of resultado.simulacion.nodos) {
        if (!mapa.has(nodo.id)) mapa.set(nodo.id, 'tenue')
      }
    }
    return mapa
  }, [visible, resultado, paso, total])

  return {
    simulacion: resultado?.simulacion ?? null,
    nodos,
    aristas,
    orden: resultado?.orden ?? [],
    desactualizada,
    enCurso: visible && paso <= total,
    cargando,
    error,
    simular,
    limpiar,
  }
}
