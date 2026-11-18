import { useEffect, useRef } from 'react'

/** Llama a `alRefrescar` cada `intervaloMs`. Con la pestaña oculta se pausa y, al volver a verla,
 * refresca de inmediato. No llama al montar: la carga inicial es de cada hook. */
export function useRefrescoPeriodico(alRefrescar: () => void, intervaloMs: number) {
  const ultimo = useRef(alRefrescar)
  useEffect(() => {
    ultimo.current = alRefrescar
  })

  useEffect(() => {
    let temporizador: ReturnType<typeof setInterval> | null = null

    function iniciar() {
      temporizador = setInterval(() => ultimo.current(), intervaloMs)
    }
    function detener() {
      if (temporizador !== null) clearInterval(temporizador)
      temporizador = null
    }
    function alCambiarVisibilidad() {
      if (document.hidden) detener()
      else if (temporizador === null) {
        ultimo.current()
        iniciar()
      }
    }

    if (!document.hidden) iniciar()
    document.addEventListener('visibilitychange', alCambiarVisibilidad)
    return () => {
      detener()
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
    }
  }, [intervaloMs])
}
