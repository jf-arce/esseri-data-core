import { useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { obtenerIndicadoresDireccion } from '@/modules/panel-admin/services/obtener-indicadores-direccion'
import type { IndicadoresDireccion } from '@/modules/panel-admin/types'

const indicadoresVacios: IndicadoresDireccion = {
  alumnos_activos: 0,
  deuda_pendiente_total: '0',
  inasistencias_hoy: 0,
  solicitudes_compra_pendientes: 0,
}

export function useIndicadoresDireccion() {
  const [estado, setEstado] = useState<{
    datos: IndicadoresDireccion
    cargando: boolean
    error: string | null
  }>({ datos: indicadoresVacios, cargando: true, error: null })

  useEffect(() => {
    const controller = new AbortController()

    obtenerIndicadoresDireccion(controller.signal)
      .then((datos) => setEstado({ datos, cargando: false, error: null }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setEstado((actual) => ({
          datos: actual.datos,
          cargando: false,
          error:
            error instanceof ApiError
              ? error.detail
              : 'No se pudieron cargar los indicadores de Dirección.',
        }))
      })

    return () => controller.abort()
  }, [])

  return estado
}
