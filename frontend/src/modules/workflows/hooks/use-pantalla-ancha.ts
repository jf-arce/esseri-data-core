import { useEffect, useState } from 'react'

const ANCHO_MINIMO = 1024

function esAncha() {
  return window.innerWidth >= ANCHO_MINIMO
}

/** `true` desde el breakpoint `lg`: el inspector flota sobre el lienzo; debajo, sube como hoja. */
export function usePantallaAncha() {
  const [ancha, setAncha] = useState(esAncha)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const consulta = window.matchMedia(`(min-width: ${ANCHO_MINIMO}px)`)
    const alCambiar = () => setAncha(esAncha())
    consulta.addEventListener('change', alCambiar)
    return () => consulta.removeEventListener('change', alCambiar)
  }, [])
  return ancha
}
