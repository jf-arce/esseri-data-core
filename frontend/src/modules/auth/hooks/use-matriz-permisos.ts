import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { asignarPermisoARol } from '@/modules/auth/services/asignar-permiso-a-rol'
import { getPermisos } from '@/modules/auth/services/get-permisos'
import { getPermisosDeRol } from '@/modules/auth/services/get-permisos-de-rol'
import { getRoles } from '@/modules/auth/services/get-roles'
import { quitarPermisoARol } from '@/modules/auth/services/quitar-permiso-a-rol'
import type { Permiso, Rol } from '@/modules/auth/types'

type Matriz = Record<string, Set<string>>

function clonarMatriz(matriz: Matriz): Matriz {
  const clon: Matriz = {}
  for (const rolId of Object.keys(matriz)) {
    clon[rolId] = new Set(matriz[rolId])
  }
  return clon
}

interface CambioPendiente {
  rolId: string
  permisoId: string
  accion: 'agregar' | 'quitar'
}

/**
 * Trae roles x permisos y arma la matriz rol->set(permisoId). El usuario marca/desmarca
 * celdas localmente (`toggle`), y "Guardar cambios" (`guardarCambios`) emite solo los
 * POST/DELETE de las celdas que efectivamente cambiaron respecto a lo que vino del backend,
 * no una resincronización completa de las 10x N celdas.
 */
export function useMatrizPermisos() {
  const [roles, setRoles] = useState<Rol[]>([])
  const [permisos, setPermisos] = useState<Permiso[]>([])
  const [original, setOriginal] = useState<Matriz>({})
  const [marcadas, setMarcadas] = useState<Matriz>({})
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Separado de `recargar`: el efecto de montaje llama a esta función directamente, y no
  // debe disparar un setState de forma síncrona en el cuerpo del efecto — el estado inicial
  // ya cubre el primer fetch, así que acá todo setState queda detrás del primer `await`.
  const cargar = useCallback(() => {
    return Promise.all([getRoles(), getPermisos()])
      .then(([rolesRes, permisosRes]) =>
        Promise.all(rolesRes.map((rol) => getPermisosDeRol(rol.id))).then((permisosPorRol) => {
          const matriz: Matriz = {}
          rolesRes.forEach((rol, i) => {
            matriz[rol.id] = new Set(permisosPorRol[i].map((permiso) => permiso.id))
          })
          setRoles(rolesRes)
          setPermisos(permisosRes)
          setOriginal(matriz)
          setMarcadas(clonarMatriz(matriz))
        }),
      )
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.detail : 'No se pudo cargar la matriz de permisos.'),
      )
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

  const estaMarcado = useCallback(
    (rolId: string, permisoId: string) => marcadas[rolId]?.has(permisoId) ?? false,
    [marcadas],
  )

  const toggle = useCallback((rolId: string, permisoId: string) => {
    setMarcadas((prev) => {
      const siguiente = clonarMatriz(prev)
      const set = (siguiente[rolId] ??= new Set())
      if (set.has(permisoId)) {
        set.delete(permisoId)
      } else {
        set.add(permisoId)
      }
      return siguiente
    })
  }, [])

  const cambiosPendientes = useCallback((): CambioPendiente[] => {
    const cambios: CambioPendiente[] = []
    for (const rol of roles) {
      const originales = original[rol.id] ?? new Set<string>()
      const actuales = marcadas[rol.id] ?? new Set<string>()
      for (const permiso of permisos) {
        const estabaAntes = originales.has(permiso.id)
        const estaAhora = actuales.has(permiso.id)
        if (estabaAntes && !estaAhora) {
          cambios.push({ rolId: rol.id, permisoId: permiso.id, accion: 'quitar' })
        } else if (!estabaAntes && estaAhora) {
          cambios.push({ rolId: rol.id, permisoId: permiso.id, accion: 'agregar' })
        }
      }
    }
    return cambios
  }, [roles, permisos, original, marcadas])

  const hayCambiosPendientes = cambiosPendientes().length > 0

  const guardarCambios = useCallback(async () => {
    const cambios = cambiosPendientes()
    if (cambios.length === 0) return

    setGuardando(true)
    setError(null)
    try {
      await Promise.all(
        cambios.map((cambio) =>
          cambio.accion === 'agregar'
            ? asignarPermisoARol(cambio.rolId, cambio.permisoId)
            : quitarPermisoARol(cambio.rolId, cambio.permisoId),
        ),
      )
      setOriginal(clonarMatriz(marcadas))
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail : 'No se pudieron guardar los cambios de la matriz.',
      )
    } finally {
      setGuardando(false)
    }
  }, [cambiosPendientes, marcadas])

  const descartarCambios = useCallback(() => {
    setMarcadas(clonarMatriz(original))
  }, [original])

  return {
    roles,
    permisos,
    cargando,
    guardando,
    error,
    estaMarcado,
    toggle,
    hayCambiosPendientes,
    guardarCambios,
    descartarCambios,
    recargar,
  }
}
