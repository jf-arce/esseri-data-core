export interface Permiso {
  id: string
  codigo: string
  modulo: string
  accion: string
  tipo_informacion: string | null
}

export interface Rol {
  id: string
  nombre: string
  descripcion: string | null
}

export interface UsuarioConRoles {
  id: string
  email: string
  estado: string
  auth_provider: string
  ultimo_acceso: string | null
  roles: Rol[]
}

export interface PerfilRol {
  id: string
  nombre: string
  descripcion: string | null
  permisos: Permiso[]
}

export interface UsuarioActual {
  id: string
  email: string
  auth_provider: string
  estado: string
  /** Suma de todos los roles de la cuenta — informativo, ya no es lo que autoriza el backend. */
  roles: string[]
  permisos: Permiso[]
  /** Los mismos roles, desglosados: cada uno con sus propios permisos, no la suma. Alimenta
   * la pantalla "¿Cómo querés entrar?" y "Cambiar vista". */
  perfiles: PerfilRol[]
  /** Rol con el que la sesión está autorizando de verdad (RF-30). `null` si todavía no se
   * eligió uno (0 o 2+ roles recién logueado). */
  rol_activo: string | null
}
