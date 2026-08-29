import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { buscarOrdenes } from '@/modules/proveedores-compras/services/buscar-ordenes'
import type { FiltrosOrdenesBusqueda, OrdenListado } from '@/modules/proveedores-compras/types'

const LISTADO_VACIO: OrdenListado = {
  items: [],
  total: 0,
  pagina: 1,
  tamanio_pagina: 10,
  total_paginas: 0,
}

// Mismo patrón que `use-inscripciones`: `cargando` no es un estado propio sino un derivado de
// comparar la clave de la consulta en curso con la del último resultado guardado. Setearlo
// dentro del efecto sería un `setState` en effect, que la regla `react-hooks/set-state-in-effect`
// marca — y además provoca un render extra por cada cambio de filtro.
export function useBusquedaOrdenes(filtros: FiltrosOrdenesBusqueda) {
  const [revision, setRevision] = useState(0)
  const [resultado, setResultado] = useState<{
    clave: string | null
    datos: OrdenListado
    error: string | null
    sinPermiso: boolean
  }>({ clave: null, datos: LISTADO_VACIO, error: null, sinPermiso: false })

  const { buscar, estado, pagina, tamanioPagina } = filtros
  const claveSolicitud = JSON.stringify([buscar, estado, pagina, tamanioPagina, revision])

  const recargar = useCallback(() => setRevision((actual) => actual + 1), [])

  useEffect(() => {
    const controller = new AbortController()

    buscarOrdenes({ buscar, estado, pagina, tamanioPagina }, controller.signal)
      .then((datos) => {
        setResultado({ clave: claveSolicitud, datos, error: null, sinPermiso: false })
      })
      .catch((err: unknown) => {
        // Una consulta abortada no es un error: la reemplazó otra más nueva.
        if (err instanceof DOMException && err.name === 'AbortError') return
        const sinPermiso = err instanceof ApiError && err.status === 403
        setResultado((actual) => ({
          clave: claveSolicitud,
          // Se conservan los datos anteriores: vaciar la tabla ante un error deja al usuario
          // sin el contexto de lo que estaba mirando.
          datos: actual.datos,
          error: sinPermiso
            ? null
            : err instanceof ApiError
              ? err.detail
              : 'No se pudieron cargar las órdenes de compra.',
          sinPermiso,
        }))
      })

    return () => controller.abort()
  }, [buscar, estado, pagina, tamanioPagina, claveSolicitud])

  return {
    datos: resultado.datos,
    cargando: resultado.clave !== claveSolicitud,
    error: resultado.error,
    sinPermiso: resultado.sinPermiso,
    recargar,
  }
}
