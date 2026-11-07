import type { Borrador } from '../types'

export interface RespaldoBorrador {
  datos: Borrador
  actualizado: number
  localId: string
  id?: string
  version?: number
  /** True when the stored copy has edits the server has not confirmed yet. */
  pendiente?: boolean
  creacionPendiente?: Borrador
}

/** A synchronized copy is only a cache: the server holds the content. */
const RETENCION_CACHE_MS = 24 * 60 * 60 * 1000

function prefijo(usuario: string, docente: boolean) {
  return `comunicaciones:borrador:v1:${encodeURIComponent(usuario)}:${docente ? 'docente' : 'gestion'}:`
}

/** Persist synchronously so closing a tab does not depend on a deferred effect. */
export function guardarRespaldo(
  usuario: string,
  docente: boolean,
  datos: Borrador,
  metadata: {
    localId?: string
    id?: string
    version?: number
    pendiente?: boolean
    creacionPendiente?: Borrador
  } = {},
) {
  const localId = metadata.localId ?? datos.clave
  const respaldo: RespaldoBorrador = { ...metadata, datos, localId, actualizado: Date.now() }
  window.localStorage.setItem(
    `${prefijo(usuario, docente)}${encodeURIComponent(localId)}`,
    JSON.stringify(respaldo),
  )
}

/** Removes a copy only after its content is confirmed or the user explicitly discards it. */
export function olvidarRespaldo(usuario: string, docente: boolean, localId: string) {
  window.localStorage.removeItem(`${prefijo(usuario, docente)}${encodeURIComponent(localId)}`)
}

export function leerRespaldos(usuario: string, docente: boolean): RespaldoBorrador[] {
  const inicio = prefijo(usuario, docente)
  const resultados: RespaldoBorrador[] = []
  // Snapshot the keys first: removing an entry while indexing storage would shift the next
  // one into the current position and silently skip it.
  const claves: string[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const clave = window.localStorage.key(i)
    if (clave?.startsWith(inicio)) claves.push(clave)
  }
  for (const clave of claves) {
    const contenido = window.localStorage.getItem(clave)
    if (!contenido) continue
    try {
      const respaldo: unknown = JSON.parse(contenido)
      if (typeof respaldo !== 'object' || respaldo === null || !('datos' in respaldo)) continue
      const candidato = respaldo as RespaldoBorrador
      if (typeof candidato.datos?.clave !== 'string') continue
      // Expire only copies already confirmed by the server. An unsynchronized copy is the
      // author's only version and must never disappear on its own.
      if (
        candidato.id &&
        !candidato.pendiente &&
        Date.now() - candidato.actualizado > RETENCION_CACHE_MS
      ) {
        window.localStorage.removeItem(clave)
        continue
      }
      resultados.push(candidato)
    } catch {
      // Leave unreadable data untouched so it can be recovered separately.
    }
  }
  return resultados
}
