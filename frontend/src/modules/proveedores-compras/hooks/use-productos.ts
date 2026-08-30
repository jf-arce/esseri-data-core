import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarProductos } from '@/modules/proveedores-compras/services/listar-productos'
import type { ProductoServicio } from '@/modules/proveedores-compras/types'

export function useProductos() {
  const [datos, setDatos] = useState<ProductoServicio[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sinPermiso, setSinPermiso] = useState(false)

  const cargar = useCallback(() => {
    return listarProductos()
      .then((productos) => {
        setDatos(productos)
        setSinPermiso(false)
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) {
          setSinPermiso(true)
          return
        }
        setError(err instanceof ApiError ? err.detail : 'No se pudo cargar el catálogo.')
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
