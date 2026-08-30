import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarProveedores } from '@/modules/proveedores-compras/services/listar-proveedores'
import type { Proveedor } from '@/modules/proveedores-compras/types'

export function useProveedores() {
  const [datos, setDatos] = useState<Proveedor[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sinPermiso, setSinPermiso] = useState(false)

  const cargar = useCallback(() => {
    return listarProveedores()
      .then((proveedores) => {
        setDatos(proveedores)
        setSinPermiso(false)
      })
      .catch((err: unknown) => {
        // Un 403 no es un error de carga sino una restricción de acceso: se resuelve con la
        // Pantalla sin permiso (§9.6 DESIGN.md), no con un banner de error reintentable.
        if (err instanceof ApiError && err.status === 403) {
          setSinPermiso(true)
          return
        }
        setError(err instanceof ApiError ? err.detail : 'No se pudieron cargar los proveedores.')
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
