import type { Permiso } from '@/modules/auth/types'

// Único lugar del frontend con códigos de permiso escritos a mano — coinciden byte a byte con
// `backend/src/auth/constants.py` (`codigo_de`). El resto de la UI nunca hardcodea un código:
// los recibe de GET /auth/permisos.
export const PERMISO_AUTENTICACION_LEER = 'autenticacion.leer'
export const PERMISO_AUTENTICACION_CREAR = 'autenticacion.crear'
export const PERMISO_AUTENTICACION_ACTUALIZAR = 'autenticacion.actualizar'
export const PERMISO_AUTENTICACION_ELIMINAR = 'autenticacion.eliminar'

export function tienePermiso(permisos: Permiso[], codigo: string): boolean {
  const [base] = codigo.split(':')
  return permisos.some((permiso) => permiso.codigo === codigo || permiso.codigo === base)
}
