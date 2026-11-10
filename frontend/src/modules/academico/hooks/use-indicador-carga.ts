import { useEffect, useRef, useState } from 'react'

/**
 * Decide cuándo mostrar un indicador de carga: aparece si la carga pasa de `demora` ms (las
 * respuestas rápidas no parpadean) y, una vez visible, se queda al menos `minimo` ms. Solo
 * retrasa el indicador, nunca los datos.
 */
export function useIndicadorCarga(cargando: boolean, demora = 200, minimo = 300) {
  const [visible, setVisible] = useState(false)
  const desde = useRef(0)

  useEffect(() => {
    if (cargando) {
      const mostrar = setTimeout(() => {
        desde.current = Date.now()
        setVisible(true)
      }, demora)
      return () => clearTimeout(mostrar)
    }
    const ocultar = setTimeout(
      () => setVisible(false),
      Math.max(0, minimo - (Date.now() - desde.current)),
    )
    return () => clearTimeout(ocultar)
  }, [cargando, demora, minimo])

  return visible
}
