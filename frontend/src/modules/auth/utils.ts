import type { Permiso, Rol, UsuarioConRoles } from '@/modules/auth/types'

// Colores de avatar/chip de identidad estables por id (§9.3 DESIGN.md: identidad puntual en
// fila densa). No son la paleta de módulo de dominio (§2.5): un rol como "Docente" o
// "Secretaría" no es un módulo del sistema, así que se le asigna un color estable por hash en
// vez de forzar una correspondencia inventada rol→módulo.
const PALETA_IDENTIDAD = [
  'var(--violeta)',
  'var(--petroleo)',
  'var(--advertencia)',
  'var(--info)',
  'var(--mod-compras)', // pizarra violácea
  'var(--mod-workflows)', // lila frío
] as const

// Fondo del chip para cada color de PALETA_IDENTIDAD (mismo índice), precalculado a hex fijo
// en vez de color-mix(in oklch, ...) en tiempo de render: ese color-mix se resuelve distinto
// entre Firefox y Chromium, así que el chip quedaba con otro tono según el navegador.
const PALETA_IDENTIDAD_SUAVE = [
  'var(--identidad-violeta-suave)',
  'var(--identidad-petroleo-suave)',
  'var(--identidad-advertencia-suave)',
  'var(--identidad-info-suave)',
  'var(--identidad-mod-compras-suave)',
  'var(--identidad-mod-workflows-suave)',
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

export function colorIdentidadSuave(semilla: string): string {
  return PALETA_IDENTIDAD_SUAVE[hashEstable(semilla) % PALETA_IDENTIDAD_SUAVE.length]
}

// Fallback para cuando no hay persona asociada a la cuenta (ej. `UsuarioActual`, que no la
// trae): se deriva un nombre de pantalla a partir de la parte local del mail
// (ej. "mariana.cufre@esseri.edu.ar" → "Cufre, Mariana").
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

// El nombre real de la persona (cargado en el alta) siempre le gana al derivado del email —
// que queda solo como fallback para cuentas sin persona asociada todavía.
export function nombreVisibleDeUsuario(usuario: UsuarioConRoles): string {
  if (usuario.persona_nombre && usuario.persona_apellido) {
    return `${usuario.persona_apellido}, ${usuario.persona_nombre}`
  }
  return nombreDeUsuario(usuario.email)
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

export function inicialesVisiblesDeUsuario(usuario: UsuarioConRoles): string {
  if (usuario.persona_nombre && usuario.persona_apellido) {
    return (usuario.persona_nombre.charAt(0) + usuario.persona_apellido.charAt(0)).toUpperCase()
  }
  return inicialesDeUsuario(usuario.email)
}

export type OrdenUsuarios = 'nombre-asc' | 'nombre-desc' | 'acceso-reciente' | 'acceso-antiguo'
export type EstadoUsuarioFiltro = 'todos' | 'activo' | 'inactivo'

interface FiltrosUsuarios {
  busqueda: string
  estado: EstadoUsuarioFiltro
  roles: string[]
  orden: OrdenUsuarios
}

// Sin acceso (o fecha inválida) cuenta como el más antiguo. Se compara el instante y no el texto
// ISO: `...13:00:00Z` y `...13:00:00.1Z` no ordenan bien como strings.
function instanteDeAcceso(usuario: UsuarioConRoles): number {
  const tiempo = usuario.ultimo_acceso ? new Date(usuario.ultimo_acceso).getTime() : 0
  return Number.isNaN(tiempo) ? 0 : tiempo
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
      const nombre = nombreVisibleDeUsuario(usuario).toLowerCase()
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
        return nombreVisibleDeUsuario(a).localeCompare(nombreVisibleDeUsuario(b), 'es')
      case 'nombre-desc':
        return nombreVisibleDeUsuario(b).localeCompare(nombreVisibleDeUsuario(a), 'es')
      case 'acceso-reciente':
        return instanteDeAcceso(b) - instanteDeAcceso(a)
      case 'acceso-antiguo':
        return instanteDeAcceso(a) - instanteDeAcceso(b)
      default:
        return 0
    }
  })

  return ordenados
}

export type OrdenRoles = 'nombre-asc' | 'nombre-desc'

// Filtro + orden de la tabla de roles (§9.1 DESIGN.md): tabla chica, solo búsqueda y orden, sin
// filtro de dato adicional (no hay otro campo por el que segmentar).
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
// acciones), lleva búsqueda, filtro múltiple de módulo y orden.
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
// filtro de módulo sobre las filas módulo·acción, sin orden (no aplica a una grilla de
// referencia con roles como columnas fijas).
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

// --- Destino después del login ---

const CLAVE_DESTINO = 'esseri:destino'
const RUTAS_EXCLUIDAS = ['/login', '/elegir-perfil']

/** Solo rutas internas: evita que un link armado lleve a otro sitio después del login. */
function esRutaInterna(ruta: string): boolean {
  if (!ruta.startsWith('/') || ruta.startsWith('//')) return false
  if (ruta.includes('\\') || ruta.includes(':')) return false
  const camino = ruta.split(/[?#]/)[0]
  return !RUTAS_EXCLUIDAS.includes(camino)
}

/** Recuerda a dónde quería ir la persona antes de que la manden a iniciar sesión. */
export function guardarDestino(ruta: string) {
  if (ruta === '/' || !esRutaInterna(ruta)) return
  try {
    sessionStorage.setItem(CLAVE_DESTINO, ruta)
  } catch {
    // Sin almacenamiento (ventana privada, sitio bloqueado): se entra a la página de inicio.
  }
}

/** Devuelve el destino guardado y lo borra. `null` si no hay o no es una ruta interna válida. */
export function consumirDestino(): string | null {
  try {
    const ruta = sessionStorage.getItem(CLAVE_DESTINO)
    if (ruta === null) return null
    sessionStorage.removeItem(CLAVE_DESTINO)
    return esRutaInterna(ruta) ? ruta : null
  } catch {
    return null
  }
}
