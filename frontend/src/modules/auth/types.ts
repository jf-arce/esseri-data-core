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
  /** Suma de todos los roles — lo que efectivamente autoriza el backend (RF-30). */
  roles: string[]
  permisos: Permiso[]
  /** Los mismos roles, desglosados: cada uno con sus propios permisos, no la suma. Alimenta
   * la pantalla "¿Cómo querés entrar?" y "Cambiar vista" — el rol activo solo filtra qué se
   * *muestra*, nunca lo que el backend permite. */
  perfiles: PerfilRol[]
}
