import type { Permiso, Rol, UsuarioConRoles } from '@/modules/auth/types'

// Colores de avatar/chip de identidad estables por id (§9.3 DESIGN.md: identidad puntual en
// fila densa). No son la paleta de módulo de dominio (§2.5): un rol como "Docente" o
// "Secretaría" no es un módulo del sistema, así que se le asigna un color estable por hash en
// vez de forzar una correspondencia inventada rol→módulo.
const PALETA_IDENTIDAD = [
  '#7C24A3', // violeta-vibrante
  '#0E7C86', // petroleo
  '#B45309', // advertencia
  '#175CD3', // info
  '#54577A', // pizarra violácea
  '#7B49E3', // lila frío (workflows)
] as const

function hashEstable(texto: string): number {
  let hash = 0
  for (let i = 0; i < texto.length; i++) {
    hash = (hash << 5) - hash + texto.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function colorIdentidad(semilla: string): string {
  return PALETA_IDENTIDAD[hashEstable(semilla) % PALETA_IDENTIDAD.length]
}

// El backend no separa nombre/apellido: hasta que lo haga, se deriva un nombre de pantalla a
// partir de la parte local del mail (ej. "mariana.cufre@esseri.edu.ar" → "Cufre, Mariana").
export function nombreDeUsuario(email: string): string {
  const parteLocal = email.split('@')[0] ?? email
  const partes = parteLocal
    .split(/[._-]+/)
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))

  if (partes.length < 2) return partes[0] ?? email
  const [nombre, ...apellido] = partes
  return `${apellido.join(' ')}, ${nombre}`
}

// Los nombres de rol llegan en distintas casings según la fuente: el JWT trae los roles de la
// cuenta tal cual los define el backend (ej. "ADMINISTRADOR DEL SISTEMA"), y `Rol.nombre` del
// ABM de roles se guarda en minúsculas (ej. "administrador del sistema"). Para mostrarlo en la
// UI (menú de avatar §8.1, chip de rol en la tabla de usuarios) se normaliza a sentence case,
// la convención de voz de §11 — nunca todo en mayúscula ni todo en minúscula.
export function formatearNombreRol(rol: string): string {
  const minusculas = rol.toLowerCase()
  return minusculas.charAt(0).toUpperCase() + minusculas.slice(1)
}

export function inicialesDeUsuario(email: string): string {
  const parteLocal = email.split('@')[0] ?? email
  const partes = parteLocal.split(/[._-]+/).filter(Boolean)
  if (partes.length === 0) return email.charAt(0).toUpperCase()
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0].charAt(0) + partes[1].charAt(0)).toUpperCase()
}

export function formatearFechaHora(iso: string | null): string {
  if (!iso) return '—'
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  const dd = String(fecha.getDate()).padStart(2, '0')
  const mm = String(fecha.getMonth() + 1).padStart(2, '0')
  const yyyy = fecha.getFullYear()
  const hh = String(fecha.getHours()).padStart(2, '0')
  const min = String(fecha.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

export type OrdenUsuarios = 'nombre-asc' | 'nombre-desc' | 'acceso-reciente' | 'acceso-antiguo'
export type EstadoUsuarioFiltro = 'todos' | 'activo' | 'inactivo'

interface FiltrosUsuarios {
  busqueda: string
  estado: EstadoUsuarioFiltro
  roles: string[]
  orden: OrdenUsuarios
}

// Filtro + orden de la tabla de usuarios, extraído del componente para poder testearlo sin
// montar la pantalla. Opera en cliente sobre la lista ya cargada de GET /auth/usuarios (§0 del
// plan): cuando el backend pagine y filtre, esta función se reemplaza por parámetros de query.
export function filtrarYOrdenarUsuarios(
  usuarios: UsuarioConRoles[],
  filtros: FiltrosUsuarios,
): UsuarioConRoles[] {
  const busqueda = filtros.busqueda.trim().toLowerCase()

  const filtrados = usuarios.filter((usuario) => {
    if (busqueda) {
      const nombre = nombreDeUsuario(usuario.email).toLowerCase()
      if (!nombre.includes(busqueda) && !usuario.email.toLowerCase().includes(busqueda)) {
        return false
      }
    }
    if (filtros.estado !== 'todos' && usuario.estado !== filtros.estado) {
      return false
    }
    if (filtros.roles.length > 0 && !usuario.roles.some((rol) => filtros.roles.includes(rol.id))) {
      return false
    }
    return true
  })

  const ordenados = [...filtrados]
  ordenados.sort((a, b) => {
    switch (filtros.orden) {
      case 'nombre-asc':
        return nombreDeUsuario(a.email).localeCompare(nombreDeUsuario(b.email), 'es')
      case 'nombre-desc':
        return nombreDeUsuario(b.email).localeCompare(nombreDeUsuario(a.email), 'es')
      case 'acceso-reciente':
        return (b.ultimo_acceso ?? '').localeCompare(a.ultimo_acceso ?? '')
      case 'acceso-antiguo':
        return (a.ultimo_acceso ?? '').localeCompare(b.ultimo_acceso ?? '')
      default:
        return 0
    }
  })

  return ordenados
}

export type OrdenRoles = 'nombre-asc' | 'nombre-desc'

// Filtro + orden de la tabla de roles (§9.1 DESIGN.md): tabla chica, solo búsqueda y orden, sin
// filtro de dato adicional (no hay otro campo por el que segmentar) ni densidad.
export function filtrarYOrdenarRoles(
  roles: Rol[],
  filtros: { busqueda: string; orden: OrdenRoles },
): Rol[] {
  const busqueda = filtros.busqueda.trim().toLowerCase()

  const filtrados = roles.filter((rol) => {
    if (!busqueda) return true
    return (
      rol.nombre.toLowerCase().includes(busqueda) ||
      (rol.descripcion ?? '').toLowerCase().includes(busqueda)
    )
  })

  const ordenados = [...filtrados]
  ordenados.sort((a, b) => {
    const cmp = a.nombre.localeCompare(b.nombre, 'es')
    return filtros.orden === 'nombre-asc' ? cmp : -cmp
  })

  return ordenados
}

export type OrdenPermisos = 'modulo-asc' | 'accion-asc'

interface FiltrosPermisos {
  busqueda: string
  modulos: string[]
  orden: OrdenPermisos
}

// Filtro + orden de la tabla de permisos (§9.1): es la tabla de más volumen (8 módulos ×
// acciones), lleva búsqueda, filtro múltiple de módulo y orden además de la densidad que ya
// maneja `DensityToggle`.
export function filtrarYOrdenarPermisos(permisos: Permiso[], filtros: FiltrosPermisos): Permiso[] {
  const busqueda = filtros.busqueda.trim().toLowerCase()

  const filtrados = permisos.filter((permiso) => {
    if (busqueda) {
      const enTexto =
        `${permiso.modulo} ${permiso.accion} ${permiso.tipo_informacion ?? ''}`.toLowerCase()
      if (!enTexto.includes(busqueda)) return false
    }
    if (filtros.modulos.length > 0 && !filtros.modulos.includes(permiso.modulo)) {
      return false
    }
    return true
  })

  const ordenados = [...filtrados]
  ordenados.sort((a, b) => {
    switch (filtros.orden) {
      case 'accion-asc':
        return a.accion.localeCompare(b.accion, 'es')
      case 'modulo-asc':
      default:
        return a.modulo.localeCompare(b.modulo, 'es')
    }
  })

  return ordenados
}

// Filtro de la matriz de permisos (§9.1): tabla de referencia de solo lectura, lleva búsqueda y
// filtro de módulo sobre las filas módulo·acción, sin orden ni densidad (no aplica a una
// grilla de referencia con roles como columnas fijas).
export function filtrarPermisosDeMatriz(
  permisos: Permiso[],
  filtros: { busqueda: string; modulos: string[] },
): Permiso[] {
  const busqueda = filtros.busqueda.trim().toLowerCase()

  return permisos.filter((permiso) => {
    if (busqueda) {
      const enTexto = `${permiso.modulo} ${permiso.accion}`.toLowerCase()
      if (!enTexto.includes(busqueda)) return false
    }
    if (filtros.modulos.length > 0 && !filtros.modulos.includes(permiso.modulo)) {
      return false
    }
    return true
  })
}
