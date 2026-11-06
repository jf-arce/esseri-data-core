import type { Borrador } from '../types'

export interface RespaldoBorrador {
  datos: Borrador
  actualizado: number
  localId: string
  id?: string
  version?: number
  creacionPendiente?: Borrador
}

function prefijo(usuario: string, docente: boolean) {
  return `comunicaciones:borrador:v1:${encodeURIComponent(usuario)}:${docente ? 'docente' : 'gestion'}:`
}

/** Persist synchronously so closing a tab does not depend on a deferred effect. */
export function guardarRespaldo(
  usuario: string,
  docente: boolean,
  datos: Borrador,
  metadata: { localId?: string; id?: string; version?: number; creacionPendiente?: Borrador } = {},
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
  for (let i = 0; i < window.localStorage.length; i++) {
    const clave = window.localStorage.key(i)
    if (!clave?.startsWith(inicio)) continue
    const contenido = window.localStorage.getItem(clave)
    if (!contenido) continue
    try {
      const respaldo: unknown = JSON.parse(contenido)
      if (typeof respaldo !== 'object' || respaldo === null || !('datos' in respaldo)) continue
      const candidato = respaldo as RespaldoBorrador
      if (typeof candidato.datos?.clave === 'string') resultados.push(candidato)
    } catch {
      // Leave unreadable data untouched so it can be recovered separately.
    }
  }
  return resultados
}
