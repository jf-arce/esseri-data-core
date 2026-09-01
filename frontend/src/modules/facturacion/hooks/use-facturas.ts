import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarFacturas } from '@/modules/facturacion/services/listar-facturas'
import type { FacturasListado, FiltrosFacturas } from '@/modules/facturacion/types'

const LISTADO_VACIO: FacturasListado = { items: [], total: 0, pagina: 1, tamanio: 10 }

export function useFacturas(filtros: FiltrosFacturas) {
  const { pagina, tamanio, estado, alumnoId, conceptoCobroId, ordenarPor, direccion } = filtros
  const [revision, setRevision] = useState(0)
  const [resultado, setResultado] = useState<{
    clave: string | null
    datos: FacturasListado
    error: string | null
    sinPermiso: boolean
  }>({ clave: null, datos: LISTADO_VACIO, error: null, sinPermiso: false })
  const clave = JSON.stringify([
    pagina,
    tamanio,
    estado,
    alumnoId,
    conceptoCobroId,
    ordenarPor,
    direccion,
    revision,
  ])
  const recargar = useCallback(() => setRevision((actual) => actual + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    listarFacturas(
      { pagina, tamanio, estado, alumnoId, conceptoCobroId, ordenarPor, direccion },
      controller.signal,
    )
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
              : 'No se pudieron cargar las facturas.',
          sinPermiso,
        }))
      })

    return () => controller.abort()
  }, [alumnoId, clave, conceptoCobroId, direccion, ordenarPor, pagina, tamanio, estado])

  const vigente = resultado.clave === clave
  return {
    datos: resultado.datos,
    cargando: !vigente,
    error: vigente ? resultado.error : null,
    sinPermiso: vigente && resultado.sinPermiso,
    recargar,
  }
}
