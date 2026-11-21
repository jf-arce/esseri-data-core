import { useEffect, useState, type RefObject } from 'react'

const ANCHO_MINIMO = 760

/** `true` si el lienzo mide al menos 760px: el inspector flota sobre él; debajo, sube como hoja. */
export function usePantallaAncha(contenedor: RefObject<HTMLElement | null>) {
  const [ancha, setAncha] = useState(true)
  useEffect(() => {
    const elemento = contenedor.current
    if (!elemento || typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(([entrada]) => {
      const ancho = entrada?.contentRect.width ?? 0
      if (ancho > 0) setAncha(ancho >= ANCHO_MINIMO)
    })
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [contenedor])
  return ancha
}
