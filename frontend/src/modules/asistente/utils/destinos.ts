import { matchPath } from 'react-router'
import { destinosDe, filtrarNav, NAV_GROUPS } from '@/layout/nav-items'
import type { Permiso } from '@/modules/auth/types'
import {
  RUTA_EJECUCIONES,
  RUTA_NOTIFICACIONES,
  RUTA_REGLAS,
  RUTA_TAREAS,
} from '@/modules/workflows/constants'
import type { ContextoPantalla, TipoAlias } from '../types'

// Claves de destino que el backend le ofrece al modelo (`DESTINOS` en
// `backend/src/asistente/herramientas_navegacion.py`) y la ruta de cada una. El modelo elige una
// clave: nunca se navega a una URL que haya generado él.
export const RUTAS_DE_DESTINO: Record<string, string> = {
  panel_direccion: '/panel',
  panel_administrativo: '/admin',
  comunicaciones: '/comunicaciones',
  familias: '/familias-alumnos',
  alumnos: '/familias-alumnos/alumnos',
  academico: '/academico',
  materias: '/academico/materias',
  asignaciones_docentes: '/academico/asignaciones',
  historial_asistencia: '/academico/historial-asistencia',
  inscripciones: '/inscripciones',
  admisiones: '/inscripciones/admisiones',
  facturas: '/facturacion',
  deuda_por_familia: '/facturacion/deudas/familias',
  cobranzas: '/facturacion/cobranzas',
  reglas_facturacion: '/facturacion/reglas',
  penalidades: '/facturacion/penalidades',
  proveedores: '/proveedores',
  solicitudes_compra: '/solicitudes-compra',
  ordenes_compra: '/ordenes-compra',
  catalogo_compras: '/catalogo-compras',
  reglas_workflows: RUTA_REGLAS,
  ejecuciones: RUTA_EJECUCIONES,
  notificaciones: RUTA_NOTIFICACIONES,
  tareas: RUTA_TAREAS,
  usuarios: '/usuarios-roles/usuarios',
  roles: '/usuarios-roles/roles',
}

/** Ruta de una clave de destino, solo si el menú del rol activo la muestra. */
// Filtros que cada pantalla entiende en su URL. El resto se descarta.
const FILTROS_DE_DESTINO: Record<string, string[]> = {
  academico: ['nivel', 'anio', 'division'],
}

const PATRON_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function rutaDeDestino(
  clave: string,
  rolActivo: string | null,
  permisos: Permiso[],
  filtros?: Record<string, string>,
): string | null {
  const ruta = RUTAS_DE_DESTINO[clave]
  if (ruta === undefined) return null
  const permitidas = destinosDe(filtrarNav(NAV_GROUPS, rolActivo, permisos))
  if (!permitidas.some((destino) => destino.ruta === ruta)) return null

  const consulta = new URLSearchParams()
  for (const nombre of FILTROS_DE_DESTINO[clave] ?? []) {
    const valor = filtros?.[nombre]
    if (valor !== undefined && PATRON_ID.test(valor)) consulta.set(nombre, valor)
  }
  const texto = consulta.toString()
  return texto === '' ? ruta : `${ruta}?${texto}`
}

// Mismas rutas que `busqueda-global.ts` para alumnos y familias. Los docentes no tienen ficha.
export function rutaDeEntidad(tipo: TipoAlias, id: string): string | null {
  if (tipo === 'DOCENTE') return null
  const segmento = tipo === 'ALUMNO' ? 'alumnos' : 'familias'
  return `/familias-alumnos/${segmento}/${encodeURIComponent(id)}`
}

/** Nombre de la pantalla de una clave de destino, tal como figura en el menú del rol activo. */
export function etiquetaDeDestino(
  clave: string,
  rolActivo: string | null,
  permisos: Permiso[],
): string | null {
  const ruta = RUTAS_DE_DESTINO[clave]
  if (ruta === undefined) return null
  const destino = destinosDe(filtrarNav(NAV_GROUPS, rolActivo, permisos)).find(
    (candidato) => candidato.ruta === ruta,
  )
  return destino?.etiqueta ?? null
}

/**
 * Nombre de la pantalla en que está la persona, tal como figura en el menú de su rol: la entrada
 * más específica que coincide con la ruta (así `/academico/historial-asistencia` gana sobre
 * `/academico`). `null` si la ruta no está en su menú.
 */
export function etiquetaDePantalla(
  pathname: string,
  rolActivo: string | null,
  permisos: Permiso[],
): string | null {
  const coincidencias = destinosDe(filtrarNav(NAV_GROUPS, rolActivo, permisos)).filter(
    (destino) => pathname === destino.ruta || pathname.startsWith(`${destino.ruta}/`),
  )
  const mejor = coincidencias.reduce<(typeof coincidencias)[number] | null>(
    (actual, candidato) =>
      actual === null || candidato.ruta.length > actual.ruta.length ? candidato : actual,
    null,
  )
  return mejor?.etiqueta ?? null
}

/** Ficha abierta según la URL (`alumnos/:alumnoId`, `familias/:familiaId`), o `null`. */
export function contextoDeRuta(pathname: string): ContextoPantalla | null {
  const alumno = matchPath('/familias-alumnos/alumnos/:alumnoId', pathname)?.params.alumnoId
  if (alumno !== undefined && PATRON_ID.test(alumno)) return { tipo: 'ALUMNO', entidad_id: alumno }
  const familia = matchPath('/familias-alumnos/familias/:familiaId', pathname)?.params.familiaId
  if (familia !== undefined && PATRON_ID.test(familia)) {
    return { tipo: 'FAMILIA', entidad_id: familia }
  }
  return null
}
