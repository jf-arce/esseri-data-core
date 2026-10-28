import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'

/** Ejecuta `alAbrir` cuando la URL trae `?<parametro>=1` y limpia el parámetro. Lo usa el
 * buscador global (Ctrl+K) para abrir un diálogo de alta, también si la página ya estaba abierta. */
export function useAbrirDesdeUrl(parametro: string, alAbrir: () => void) {
  const [searchParams, setSearchParams] = useSearchParams()
  const alAbrirRef = useRef(alAbrir)

  useEffect(() => {
    alAbrirRef.current = alAbrir
  })

  useEffect(() => {
    if (searchParams.get(parametro) !== '1') return
    alAbrirRef.current()
    const restantes = new URLSearchParams(searchParams)
    restantes.delete(parametro)
    setSearchParams(restantes, { replace: true })
  }, [parametro, searchParams, setSearchParams])
}
