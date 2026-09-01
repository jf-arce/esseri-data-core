import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { obtenerFactura } from '@/modules/facturacion/services/obtener-factura'
import type { FacturaDetalle } from '@/modules/facturacion/types'

export function useFacturaDetalle(facturaId: string | undefined) {
  const [revision, setRevision] = useState(0)
  const [resultado, setResultado] = useState<{
    clave: string | null
    factura: FacturaDetalle | null
    error: string | null
    sinPermiso: boolean
  }>({ clave: null, factura: null, error: null, sinPermiso: false })
  const clave = `${facturaId ?? ''}:${revision}`
  const recargar = useCallback(() => setRevision((actual) => actual + 1), [])

  useEffect(() => {
    if (!facturaId) return
    const controller = new AbortController()
    obtenerFactura(facturaId, controller.signal)
      .then((factura) => setResultado({ clave, factura, error: null, sinPermiso: false }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        const sinPermiso = error instanceof ApiError && error.status === 403
        setResultado({
          clave,
          factura: null,
          error: sinPermiso
            ? null
            : error instanceof ApiError
              ? error.detail
              : 'No se pudo cargar la factura.',
          sinPermiso,
        })
      })
    return () => controller.abort()
  }, [clave, facturaId])

  const vigente = resultado.clave === clave
  return {
    factura: vigente ? resultado.factura : null,
    cargando: Boolean(facturaId) && !vigente,
    error: vigente ? resultado.error : null,
    sinPermiso: vigente && resultado.sinPermiso,
    recargar,
  }
}
