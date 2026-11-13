import { useEffect, useRef, useState } from 'react'
import { cortarSeguro } from '../utils'

// Caracteres por segundo: ritmo de lectura cómodo y tope al ponerse al día.
const RITMO_BASE = 85
const MAX_CARACTERES_POR_SEGUNDO = 700

function prefiereMenosMovimiento(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Revela el texto de a poco, como una escritura continua, en vez de hacerlo aparecer a saltos
 * con cada trozo que llega. Va más rápido cuanto más texto le falta mostrar. Con `animar` en
 * falso (mensajes ya guardados) o con movimiento reducido devuelve todo el texto de una vez.
 */
export function useTextoGradual(
  texto: string,
  animar: boolean,
): { visible: string; revelando: boolean } {
  const [mostrados, setMostrados] = useState(0)
  const avance = useRef(0)

  useEffect(() => {
    if (!animar || prefiereMenosMovimiento()) return
    avance.current = Math.min(avance.current, texto.length)
    let marco = 0
    let anterior: number | null = null
    const paso = (ahora: number) => {
      const falta = texto.length - avance.current
      if (falta <= 0) return
      // Tiempo real entre cuadros: el ritmo no depende de los Hz de la pantalla.
      const segundos = anterior === null ? 1 / 60 : Math.min((ahora - anterior) / 1000, 0.1)
      anterior = ahora
      // Ritmo parejo y pausado; solo acelera si se acumuló mucho texto sin mostrar.
      const ritmo = Math.min(MAX_CARACTERES_POR_SEGUNDO, Math.max(RITMO_BASE, falta * 1.5))
      avance.current = Math.min(texto.length, avance.current + ritmo * segundos)
      setMostrados(Math.floor(avance.current))
      marco = requestAnimationFrame(paso)
    }
    marco = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(marco)
  }, [texto, animar])

  if (!animar || prefiereMenosMovimiento()) return { visible: texto, revelando: false }
  const hasta = Math.min(mostrados, texto.length)
  return {
    visible: cortarSeguro(texto, hasta),
    revelando: hasta < texto.length,
  }
}
