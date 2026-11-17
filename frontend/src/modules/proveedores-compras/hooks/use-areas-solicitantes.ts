import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { listarAreasSolicitantes } from '@/modules/proveedores-compras/services/listar-areas-solicitantes'
import type { AreaSolicitante } from '@/modules/proveedores-compras/types'

// Catálogo de áreas que alimenta el select del formulario y el filtro del listado.
export function useAreasSolicitantes() {
  const [datos, setDatos] = useState<AreaSolicitante[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(() => {
    return listarAreasSolicitantes()
      .then(setDatos)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.detail : 'No se pudieron cargar las áreas.')
      })
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  return { datos, cargando, error }
}
