import type { Permiso } from '@/modules/auth/types'

// Único lugar del frontend con códigos de permiso escritos a mano — coinciden byte a byte con
// `backend/src/auth/constants.py` (`codigo_de`). El resto de la UI nunca hardcodea un código:
// los recibe de GET /auth/permisos.
export const PERMISO_AUTENTICACION_LEER = 'autenticacion.leer'
export const PERMISO_AUTENTICACION_CREAR = 'autenticacion.crear'
export const PERMISO_AUTENTICACION_ACTUALIZAR = 'autenticacion.actualizar'
export const PERMISO_AUTENTICACION_ELIMINAR = 'autenticacion.eliminar'
export const PERMISO_PANEL_ADMIN_LEER = 'panel_administrativo.leer'

export const PERMISO_FAMILIAS_ALUMNOS_LEER = 'familias_alumnos.leer'
export const PERMISO_FAMILIAS_ALUMNOS_CREAR = 'familias_alumnos.crear'
export const PERMISO_FAMILIAS_ALUMNOS_ACTUALIZAR = 'familias_alumnos.actualizar'

export const PERMISO_ACADEMICO_LEER = 'academico.leer'
export const PERMISO_ACADEMICO_CREAR = 'academico.crear'
export const PERMISO_ACADEMICO_ACTUALIZAR = 'academico.actualizar'
// Variante acotada de `academico.actualizar`, solo para tomar/editar asistencia (RF-06) — un
// docente la tiene, pero no el `actualizar` sin tipo que exige la estructura curricular
// (niveles/años/divisiones/materias/asignaciones docentes). Ver el comentario de docente en
// `database/seeds/grupo-b.yaml` y `backend/src/auth/constants.py`.
export const PERMISO_ACADEMICO_ACTUALIZAR_ASISTENCIA = 'academico.actualizar:asistencia'

export const PERMISO_INSCRIPCIONES_LEER = 'inscripciones.leer'
export const PERMISO_INSCRIPCIONES_CREAR = 'inscripciones.crear'

export const PERMISO_FACTURACION_LEER = 'facturacion.leer'
export const PERMISO_FACTURACION_CREAR = 'facturacion.crear'
export const PERMISO_FACTURACION_ACTUALIZAR = 'facturacion.actualizar'

export const PERMISO_PROVEEDORES_COMPRAS_LEER = 'proveedores_compras.leer'

export function tienePermiso(permisos: Permiso[], codigo: string): boolean {
  const [base] = codigo.split(':')
  return permisos.some((permiso) => permiso.codigo === codigo || permiso.codigo === base)
}
