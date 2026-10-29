import { useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import {
  consultarHistorial,
  obtenerCiclosHistorial,
  obtenerOpcionesHistorial,
  type FiltrosHistorial,
} from '../services/consultar-historial'

function useRecurso<T>(clave: string, cargar: (clave: string) => Promise<T>) {
  const [revision, setRevision] = useState(0)
  const [estado, setEstado] = useState<{
    clave: string
    revision: number
    datos: T | null
    cargando: boolean
    error: string | null
    sinPermiso: boolean
  }>({ clave: '', revision: -1, datos: null, cargando: true, error: null, sinPermiso: false })
  useEffect(() => {
    let activo = true
    cargar(clave)
      .then((datos) => {
        if (activo)
          setEstado({ clave, revision, datos, cargando: false, error: null, sinPermiso: false })
      })
      .catch((error: unknown) => {
        if (activo)
          setEstado({
            clave,
            revision,
            datos: null,
            cargando: false,
            error:
              error instanceof Error
                ? error.message
                : 'No se pudo consultar la asistencia. Intentá de nuevo.',
            sinPermiso: error instanceof ApiError && error.status === 403,
          })
      })
    return () => {
      activo = false
    }
  }, [clave, cargar, revision])
  return {
    ...(estado.clave === clave && estado.revision === revision
      ? estado
      : { datos: null, cargando: true, error: null, sinPermiso: false }),
    recargar: () => setRevision((valor) => valor + 1),
  }
}

const consultarClave = (clave: string) => consultarHistorial(JSON.parse(clave) as FiltrosHistorial)

export function useConsultaHistorial(filtros: FiltrosHistorial) {
  return useRecurso(JSON.stringify(filtros), consultarClave)
}

export function useOpcionesHistorial(ciclo: string) {
  return useRecurso(ciclo, obtenerOpcionesHistorial)
}

export function useCiclosHistorial() {
  return useRecurso('ciclos', obtenerCiclosHistorial)
}
