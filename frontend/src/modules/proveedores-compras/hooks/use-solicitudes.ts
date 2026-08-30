import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarSolicitudes } from '@/modules/proveedores-compras/services/listar-solicitudes'
import type { SolicitudCompra } from '@/modules/proveedores-compras/types'

export function useSolicitudes() {
  const [datos, setDatos] = useState<SolicitudCompra[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sinPermiso, setSinPermiso] = useState(false)

  const cargar = useCallback(() => {
    return listarSolicitudes()
      .then((solicitudes) => {
        setDatos(solicitudes)
        setSinPermiso(false)
      })
      .catch((err: unknown) => {
        // Igual que en use-proveedores: un 403 es restriccion de acceso, no error de carga.
        if (err instanceof ApiError && err.status === 403) {
          setSinPermiso(true)
          return
        }
        setError(err instanceof ApiError ? err.detail : 'No se pudieron cargar las solicitudes.')
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
