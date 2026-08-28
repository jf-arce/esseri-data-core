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

export interface UsuarioActual {
  id: string
  email: string
  auth_provider: string
  estado: string
  roles: string[]
  permisos: Permiso[]
}
