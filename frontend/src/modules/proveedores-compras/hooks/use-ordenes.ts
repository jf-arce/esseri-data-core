import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarOrdenes } from '@/modules/proveedores-compras/services/listar-ordenes'
import type { OrdenCompra } from '@/modules/proveedores-compras/types'

export function useOrdenes() {
  const [datos, setDatos] = useState<OrdenCompra[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sinPermiso, setSinPermiso] = useState(false)

  const cargar = useCallback(() => {
    return listarOrdenes()
      .then((ordenes) => {
        setDatos(ordenes)
        setSinPermiso(false)
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) {
          setSinPermiso(true)
          return
        }
        setError(
          err instanceof ApiError ? err.detail : 'No se pudieron cargar las órdenes de compra.',
        )
      })
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const recargar = useCallback(() => {
    setCargando(true)
    setError(null)
    return cargar()
  }, [cargar])

  return { datos, cargando, error, sinPermiso, recargar }
}
