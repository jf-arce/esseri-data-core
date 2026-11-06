import { ApiError } from '@/api/client'
import type { Borrador } from '../types'

export type EstadoSincronizacion =
  'inactivo' | 'pendiente' | 'guardando' | 'guardado' | 'sin-conexion' | 'error' | 'conflicto'

export interface SnapshotBorrador {
  datos: Borrador
  id?: string
  version?: number
}

export interface ConfirmacionBorrador {
  id: string
  version: number
}

export class ConflictoBorradorError extends Error {
  constructor() {
    super('El borrador fue modificado en otra sesión.')
    this.name = 'ConflictoBorradorError'
  }
}

type Guardar = (snapshot: SnapshotBorrador) => Promise<ConfirmacionBorrador>

interface Opciones {
  guardar: Guardar
  onEstado?: (estado: EstadoSincronizacion) => void
  onConfirmado?: (confirmacion: ConfirmacionBorrador) => void
  debounceMs?: number
  reintentosMaximos?: number
  baseReintentoMs?: number
}

function esConflicto(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    /otra sesión|versión publicada|ya se usó/i.test(error.detail ?? '')
  )
}

function esRed(error: unknown) {
  if (error instanceof ApiError) return error.status === 0 || error.status >= 500
  return error instanceof TypeError
}

/**
 * Serializes draft writes: one request in flight, newest edits kept in a queue, and creation
 * retried with the exact snapshot that was first sent so the server-side idempotency key
 * resolves the same draft instead of creating another one.
 */
export class SincronizadorBorrador {
  private id?: string
  private version?: number
  private pendiente?: Borrador
  private creacion?: SnapshotBorrador
  private enviando = false
  private espera?: Promise<void>
  private timer?: ReturnType<typeof setTimeout>
  private reintentos = 0
  private detenido = false
  private estado: EstadoSincronizacion = 'inactivo'
  private readonly opciones: Opciones
  private readonly debounceMs: number
  private readonly reintentosMaximos: number
  private readonly baseReintentoMs: number

  constructor(opciones: Opciones) {
    this.opciones = opciones
    this.debounceMs = opciones.debounceMs ?? 2500
    this.reintentosMaximos = opciones.reintentosMaximos ?? 5
    this.baseReintentoMs = opciones.baseReintentoMs ?? 2000
  }

  estadoActual() {
    return this.estado
  }

  inicializar(id: string, version: number) {
    this.id = id
    this.version = version
  }

  encolar(datos: Borrador) {
    this.pendiente = datos
    if (this.detenido || this.estado === 'conflicto') return
    this.cambiarEstado('pendiente')
    this.cancelarTimer()
    this.timer = setTimeout(() => {
      void this.procesar()
    }, this.debounceMs)
  }

  reanudar() {
    this.detenido = false
    if (this.pendiente) this.encolar(this.pendiente)
  }

  reintentar() {
    this.reintentos = 0
    if (this.pendiente) this.encolar(this.pendiente)
  }

  /** Explicit conflict resolution: adopt the server version and push the local draft over it. */
  resolverCon(version: number) {
    this.version = version
    this.creacion = undefined
    this.reintentos = 0
    this.estado = 'pendiente'
    if (this.pendiente) this.encolar(this.pendiente)
  }

  /** Drops queued work only when the user explicitly chooses the server version. */
  descartarPendiente() {
    this.pendiente = undefined
    this.creacion = undefined
    this.cancelarTimer()
    this.cambiarEstado('guardado')
  }

  detener() {
    this.detenido = true
    this.cancelarTimer()
  }

  async enviarAhora(): Promise<ConfirmacionBorrador> {
    this.cancelarTimer()
    if (this.enviando) await this.espera
    if (this.estadoActual() === 'conflicto') throw new ConflictoBorradorError()
    if (this.pendiente) await this.procesar()
    if (this.estadoActual() === 'conflicto') throw new ConflictoBorradorError()
    if (this.estadoActual() === 'sin-conexion' || this.estadoActual() === 'error') {
      throw new Error('No se pudo guardar el borrador en el servidor.')
    }
    if (!this.id || this.version === undefined) {
      throw new Error('No se pudo guardar el borrador en el servidor.')
    }
    return { id: this.id, version: this.version }
  }

  private cancelarTimer() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
  }

  private cambiarEstado(estado: EstadoSincronizacion) {
    this.estado = estado
    this.opciones.onEstado?.(estado)
  }

  private async procesar(): Promise<void> {
    if (this.enviando) return this.espera
    this.cancelarTimer()
    this.enviando = true
    this.espera = (async () => {
      try {
        while (this.pendiente) {
          const datos = this.pendiente
          this.pendiente = undefined
          const snapshot: SnapshotBorrador = this.id
            ? { datos, id: this.id, version: this.version }
            : (this.creacion ??= { datos })
          this.cambiarEstado('guardando')
          try {
            const confirmacion = await this.opciones.guardar(snapshot)
            this.id = confirmacion.id
            this.version = confirmacion.version
            this.creacion = undefined
            this.reintentos = 0
            this.opciones.onConfirmado?.(confirmacion)
          } catch (error) {
            // Keep the newest local edits; never discard them on a failed write.
            this.pendiente ??= datos
            if (esConflicto(error)) {
              this.cambiarEstado('conflicto')
              return
            }
            if (esRed(error)) {
              this.cambiarEstado('sin-conexion')
              this.programarReintento()
              return
            }
            this.cambiarEstado('error')
            return
          }
        }
        this.cambiarEstado('guardado')
      } finally {
        this.enviando = false
      }
    })()
    return this.espera
  }

  private programarReintento() {
    if (this.detenido || this.reintentos >= this.reintentosMaximos) return
    const espera = Math.min(this.baseReintentoMs * 2 ** this.reintentos, 30_000)
    this.reintentos += 1
    this.cancelarTimer()
    this.timer = setTimeout(() => {
      void this.procesar()
    }, espera)
  }
}
