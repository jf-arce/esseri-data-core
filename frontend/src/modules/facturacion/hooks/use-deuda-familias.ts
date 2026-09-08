import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarDeudaFamilias } from '@/modules/facturacion/services/listar-deuda-familias'
import type { DeudaFamiliasListado, FiltrosDeudaFamilias } from '@/modules/facturacion/types'

const LISTADO_VACIO: DeudaFamiliasListado = { items: [], total: 0, pagina: 1, tamanio: 10 }

export function useDeudaFamilias(filtros: FiltrosDeudaFamilias) {
  const { pagina, tamanio, estado, buscar } = filtros
  const [revision, setRevision] = useState(0)
  const [resultado, setResultado] = useState<{
    clave: string | null
    datos: DeudaFamiliasListado
    error: string | null
    sinPermiso: boolean
  }>({ clave: null, datos: LISTADO_VACIO, error: null, sinPermiso: false })
  const clave = JSON.stringify([pagina, tamanio, estado, buscar, revision])
  const recargar = useCallback(() => setRevision((actual) => actual + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    listarDeudaFamilias({ pagina, tamanio, estado, buscar }, controller.signal)
      .then((datos) => setResultado({ clave, datos, error: null, sinPermiso: false }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        const sinPermiso = error instanceof ApiError && error.status === 403
        setResultado((actual) => ({
          clave,
          datos: actual.datos,
          error: sinPermiso
            ? null
            : error instanceof ApiError
              ? error.detail
              : 'No se pudo cargar la deuda por familia.',
          sinPermiso,
        }))
      })

    return () => controller.abort()
  }, [buscar, clave, estado, pagina, tamanio])

  const vigente = resultado.clave === clave
  return {
    datos: resultado.datos,
    cargando: !vigente,
    error: vigente ? resultado.error : null,
    sinPermiso: vigente && resultado.sinPermiso,
    recargar,
  }
}
