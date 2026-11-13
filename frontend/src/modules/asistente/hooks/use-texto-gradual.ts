import { useEffect, useRef, useState } from 'react'
import { cortarSeguro } from '../utils'

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
    const paso = () => {
      if (avance.current >= texto.length) return
      const falta = texto.length - avance.current
      avance.current = Math.min(texto.length, avance.current + Math.max(1, Math.ceil(falta / 14)))
      setMostrados(avance.current)
      marco = requestAnimationFrame(paso)
    }
    marco = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(marco)
  }, [texto, animar])

  if (!animar || prefiereMenosMovimiento()) return { visible: texto, revelando: false }
  const hasta = Math.min(mostrados, texto.length)
  return { visible: cortarSeguro(texto, hasta), revelando: hasta < texto.length }
}
