import { tienePermiso } from '@/modules/auth/constants'
import type { Permiso } from '@/modules/auth/types'
import { COMANDOS, SUGERENCIAS, type ComandoDeEntrada } from '../constants'
import type { AliasResuelto, ComandoBackend, Mencion } from '../types'
import { nombreCorrido, partirTextoConAlias } from './alias'

/** "@mar" justo antes del cursor: lo que sigue a la última arroba sin espacios. */
export function consultaDeMencion(texto: string, cursor: number): string | null {
  const coincidencia = texto.slice(0, cursor).match(/(?:^|\s)@([^\s@]*)$/)
  return coincidencia ? coincidencia[1] : null
}

/** "/deu" si el mensaje empieza con `/` y el cursor sigue en esa primera palabra. */
export function consultaDeComando(texto: string, cursor: number): string | null {
  const coincidencia = texto.slice(0, cursor).match(/^\/([^\s/]*)$/)
  return coincidencia ? coincidencia[1] : null
}

export function sinTildes(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** Atajos que el rol puede usar y que empiezan con lo escrito después de `/`. */
export function comandosDisponibles(permisos: Permiso[], consulta: string): ComandoDeEntrada[] {
  const buscado = sinTildes(consulta)
  return COMANDOS.filter(
    (c) =>
      c.permisos.every((permiso) => tienePermiso(permisos, permiso)) &&
      sinTildes(c.nombre).startsWith(buscado),
  )
}

/**
 * Qué se manda al enviar. El atajo elegido define el comando; sin texto después, va la pregunta
 * por defecto del atajo (los que exigen texto no se pueden enviar vacíos: devuelven `''`).
 */
export function resolverEnvio(
  contenido: string,
  elegido: ComandoDeEntrada | null,
): { contenido: string; comando: ComandoBackend | null } {
  const texto = contenido.trim()
  if (elegido === null || elegido.comando === null) return { contenido: texto, comando: null }
  return {
    contenido: texto === '' ? elegido.preguntaPorDefecto : texto,
    comando: elegido.comando,
  }
}

/** Atajo escrito a mano al inicio del campo (`/grafico deuda`): el atajo y el resto del texto. */
export function atajoAlInicio(
  texto: string,
  permisos: Permiso[],
): { comando: ComandoDeEntrada; resto: string } | null {
  const coincidencia = texto.match(/^\/([^\s/]+) ([\s\S]*)$/)
  if (coincidencia === null) return null
  const comando = comandosDisponibles(permisos, coincidencia[1]).find(
    (c) => c.nombre === coincidencia[1] && c.comando !== null,
  )
  return comando === undefined ? null : { comando, resto: coincidencia[2] }
}

/** Separa el `/atajo` con el que se guardó un mensaje del usuario de lo que escribió después. */
export function separarComando(contenido: string): {
  comando: ComandoDeEntrada | null
  texto: string
} {
  const coincidencia = contenido.match(/^\/([a-z]+)(?: ([\s\S]*))?$/)
  const comando =
    coincidencia === null
      ? undefined
      : COMANDOS.find((c) => c.comando !== null && c.nombre === coincidencia[1])
  if (coincidencia === null || comando === undefined) return { comando: null, texto: contenido }
  return { comando, texto: coincidencia[2] ?? '' }
}

/** Palabras sin tildes ni mayúsculas, con los números y las letras separados ("3°A" → 3, a). */
function palabrasDeBusqueda(texto: string): string[] {
  return sinTildes(texto).match(/\d+|[a-z\u00f1]+/g) ?? []
}

/**
 * Coincidencia para filtrar docentes y cursos en el navegador: cada palabra escrita tiene que ser
 * el comienzo de alguna palabra del nombre, en cualquier orden y sin tildes ni mayúsculas. Así
 * "3", "a", "3a", "3° a", "prim" o "3 a primario" encuentran a "3°A de Primario", y "ana perez"
 * a "Ana Pérez".
 */
export function coincideConBusqueda(nombre: string, consulta: string): boolean {
  const palabrasNombre = palabrasDeBusqueda(nombre)
  return palabrasDeBusqueda(consulta).every((buscada) =>
    palabrasNombre.some((palabra) => palabra.startsWith(buscada)),
  )
}

/**
 * Lo que se precarga al editar una pregunta: el texto con las personas como `@Nombre` (cuando se
 * conoce quiénes son) y las menciones reconstruidas para volver a mandarlas.
 */
export function prepararEdicion(
  contenido: string,
  porAlias: Record<string, AliasResuelto>,
): { comando: ComandoDeEntrada | null; texto: string; menciones: Mencion[] } {
  const { comando, texto } = separarComando(contenido)
  const menciones: Mencion[] = []
  const armado = partirTextoConAlias(texto)
    .map((trozo) => {
      if (trozo.tipo === 'texto') return trozo.valor
      const resuelto = porAlias[trozo.alias]
      if (resuelto === undefined) return trozo.alias
      const mencion = `@${nombreCorrido(resuelto.nombre)}`
      if (!menciones.some((m) => m.entidad_id === resuelto.entidad_id)) {
        menciones.push({ tipo: resuelto.tipo, entidad_id: resuelto.entidad_id, texto: mencion })
      }
      return mencion
    })
    .join('')
  return { comando, texto: armado, menciones }
}

/** Preguntas de arranque que el rol activo puede hacer. */
export function sugerenciasPermitidas(permisos: Permiso[]): string[] {
  return SUGERENCIAS.filter((s) => tienePermiso(permisos, s.permiso)).map((s) => s.texto)
}
