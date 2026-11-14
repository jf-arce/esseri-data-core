import { useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { obtenerIndicadoresDireccion } from '@/modules/panel-admin/services/obtener-indicadores-direccion'
import type { IndicadoresDireccion } from '@/modules/panel-admin/types'

const indicadoresVacios: IndicadoresDireccion = {
  alumnos_activos: 0,
  deuda_pendiente_total: '0',
  inasistencias_hoy: 0,
  solicitudes_compra_pendientes: 0,
  deuda_vencida_total: '0',
  familias_en_mora: 0,
  altas_mes: 0,
  bajas_mes: 0,
  asistencias_registradas_hoy: 0,
  solicitud_pendiente_mas_antigua: null,
}

interface Estado {
  datos: IndicadoresDireccion
  cargando: boolean
  // Recarga manual: los datos anteriores siguen visibles mientras llegan los nuevos.
  actualizando: boolean
  actualizadoEn: Date | null
  error: string | null
}

export function useIndicadoresDireccion() {
  const [version, setVersion] = useState(0)
  const [estado, setEstado] = useState<Estado>({
    datos: indicadoresVacios,
    cargando: true,
    actualizando: false,
    actualizadoEn: null,
    error: null,
  })

  useEffect(() => {
    const controller = new AbortController()
    obtenerIndicadoresDireccion(controller.signal)
      .then((datos) =>
        // Un backend desactualizado puede omitir campos nuevos: se completan para no pintar
        // "NaN" ni "undefined" en las tarjetas.
        setEstado({
          datos: { ...indicadoresVacios, ...datos },
          cargando: false,
          actualizando: false,
          actualizadoEn: new Date(),
          error: null,
        }),
      )
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setEstado((actual) => ({
          ...actual,
          cargando: false,
          actualizando: false,
          error:
            error instanceof ApiError
              ? error.detail
              : 'No se pudieron cargar los indicadores de Dirección.',
        }))
      })

    return () => controller.abort()
  }, [version])

  // `version` también lo usa la página para recargar el detalle junto con los indicadores.
  const recargar = () => {
    setEstado((actual) => ({ ...actual, actualizando: true }))
    setVersion((actual) => actual + 1)
  }

  return { ...estado, version, recargar }
}
