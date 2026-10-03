import { useEffect, useState } from 'react'
import { getRoles } from '@/modules/auth/services/get-roles'
import { getUsuarios } from '@/modules/auth/services/get-usuarios'
import type { Rol, UsuarioConRoles } from '@/modules/auth/types'

/** Roles y usuarios activos para elegir destinatarios. Los endpoints son de Autenticación (otro
 * permiso): si alguno responde 403 o falla, `noDisponible` es true y el editor sigue andando. */
export function useDestinatariosDisponibles() {
  const [resultado, setResultado] = useState<{
    roles: Rol[]
    usuarios: UsuarioConRoles[]
    cargando: boolean
    noDisponible: boolean
  }>({ roles: [], usuarios: [], cargando: true, noDisponible: false })

  useEffect(() => {
    let vigente = true
    Promise.all([getRoles(), getUsuarios()])
      .then(([roles, usuarios]) => {
        if (!vigente) return
        setResultado({
          roles,
          usuarios: usuarios.filter((usuario) => usuario.estado === 'activo'),
          cargando: false,
          noDisponible: false,
        })
      })
      .catch(() => {
        if (vigente) setResultado({ roles: [], usuarios: [], cargando: false, noDisponible: true })
      })
    return () => {
      vigente = false
    }
  }, [])

  return resultado
}
