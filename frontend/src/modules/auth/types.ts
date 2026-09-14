export interface Permiso {
  id: string
  codigo: string
  modulo: string
  accion: string
  tipo_informacion: string | null
}

export interface Rol {
  id: string
  codigo: string
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
  /** Sin persona no se le puede crear una ficha Docente (ver usuario-roles-dialog). */
  persona_id: string | null
  /** Nombre real de la persona; null si la cuenta no tiene persona asociada todavía. Preferirlo
   * siempre sobre `nombreDeUsuario(email)` — ver `nombreVisibleDeUsuario` en utils.ts. */
  persona_nombre: string | null
  persona_apellido: string | null
}

export interface PersonaCreate {
  nombre: string
  apellido: string
  dni: string
  telefono?: string | null
  sexo?: string | null
}

export type AccesoUpdate = { metodo: 'google' } | { metodo: 'local'; password: string }

export type AccesoCreate =
  | ({ email: string } & Extract<AccesoUpdate, { metodo: 'google' }>)
  | ({ email: string } & Extract<AccesoUpdate, { metodo: 'local' }>)

export interface UsuarioCreate {
  persona: PersonaCreate
  acceso: AccesoCreate
  rol_ids: string[]
}

export interface PersonaUpdate {
  nombre?: string
  apellido?: string
  dni?: string
  telefono?: string | null
  sexo?: string | null
}

export interface UsuarioUpdate {
  persona?: PersonaUpdate
  email?: string
}

export type EstadoUsuario = 'activo' | 'inactivo'

export interface UsuarioDetalle extends UsuarioConRoles {
  persona_dni: string | null
  persona_telefono: string | null
}

export interface PerfilRol {
  id: string
  codigo: string
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
