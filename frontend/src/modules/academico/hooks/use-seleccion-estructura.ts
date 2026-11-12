import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import type { SeleccionEstructura } from '@/modules/academico/hooks/use-estructura-academica'

/**
 * Nivel, año y división elegidos viven en la URL (`?nivel=&anio=&division=`), así se puede
 * recargar o volver atrás sin perder el lugar. Al cambiar un nivel se descartan los de abajo.
 */
export function useSeleccionEstructura() {
  const [params, setParams] = useSearchParams()

  const pedida: SeleccionEstructura = {
    nivel: params.get('nivel'),
    anio: params.get('anio'),
    division: params.get('division'),
  }

  const elegir = useCallback(
    (cambios: Partial<SeleccionEstructura>) => {
      setParams((previos) => {
        const siguientes = new URLSearchParams(previos)
        siguientes.delete('resaltar')
        const orden: (keyof SeleccionEstructura)[] = ['nivel', 'anio', 'division']
        const desde = orden.findIndex((clave) => clave in cambios)
        orden.slice(desde + 1).forEach((clave) => siguientes.delete(clave))
        orden.forEach((clave) => {
          const valor = cambios[clave]
          if (valor) siguientes.set(clave, valor)
          else if (clave in cambios) siguientes.delete(clave)
        })
        return siguientes
      })
    },
    [setParams],
  )

  /** Va a un curso y pide resaltar una de sus materias (`?resaltar=`). */
  const irA = useCallback(
    (seleccion: SeleccionEstructura, materiaCursoId: string) => {
      const siguientes = new URLSearchParams()
      if (seleccion.nivel) siguientes.set('nivel', seleccion.nivel)
      if (seleccion.anio) siguientes.set('anio', seleccion.anio)
      if (seleccion.division) siguientes.set('division', seleccion.division)
      siguientes.set('resaltar', materiaCursoId)
      setParams(siguientes)
    },
    [setParams],
  )

  return { pedida, elegir, irA }
}
