import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'

/** Ejecuta `alAbrir` cuando la URL trae `?<parametro>=1` y limpia el parámetro. Lo usa el
 * buscador global (Ctrl+K) para abrir un diálogo de alta, también si la página ya estaba abierta.
 * Con `habilitado` en false (el usuario no puede hacer esa alta) solo limpia el parámetro. */
export function useAbrirDesdeUrl(parametro: string, alAbrir: () => void, habilitado = true) {
  const [searchParams, setSearchParams] = useSearchParams()
  const alAbrirRef = useRef(alAbrir)

  useEffect(() => {
    alAbrirRef.current = alAbrir
  })

  useEffect(() => {
    if (searchParams.get(parametro) !== '1') return
    if (habilitado) alAbrirRef.current()
    const restantes = new URLSearchParams(searchParams)
    restantes.delete(parametro)
    setSearchParams(restantes, { replace: true })
  }, [parametro, habilitado, searchParams, setSearchParams])
}
