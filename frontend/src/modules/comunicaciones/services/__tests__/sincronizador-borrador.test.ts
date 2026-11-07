import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import type { Borrador } from '../../types'
import {
  ConflictoBorradorError,
  SincronizadorBorrador,
  type SnapshotBorrador,
} from '../sincronizador-borrador'

type Guardar = (snapshot: SnapshotBorrador) => Promise<{ id: string; version: number }>

const base: Borrador = {
  clave: 'clave-local',
  asunto: 'A',
  cuerpo: '',
  audiencia: { tipo: 'todos', ids: [] },
}

function crear(guardar: (snapshot: SnapshotBorrador) => Promise<{ id: string; version: number }>) {
  const estados: string[] = []
  const confirmados: { id: string; version: number }[] = []
  const sincronizador = new SincronizadorBorrador({
    guardar,
    onEstado: (estado) => estados.push(estado),
    onConfirmado: (confirmacion) => confirmados.push(confirmacion),
    debounceMs: 2000,
    baseReintentoMs: 1000,
    reintentosMaximos: 2,
  })
  return { sincronizador, estados, confirmados }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('SincronizadorBorrador', () => {
  it('coalesces rapid edits into a single creation request', async () => {
    const guardar = vi.fn<Guardar>().mockResolvedValue({ id: 'remoto', version: 1 })
    const { sincronizador, confirmados } = crear(guardar)
    sincronizador.encolar({ ...base, asunto: 'A' })
    sincronizador.encolar({ ...base, asunto: 'AB' })
    sincronizador.encolar({ ...base, asunto: 'ABC' })
    await vi.advanceTimersByTimeAsync(2000)
    expect(guardar).toHaveBeenCalledTimes(1)
    expect(guardar.mock.calls[0][0]).toEqual({ datos: { ...base, asunto: 'ABC' } })
    expect(confirmados).toEqual([{ id: 'remoto', version: 1 }])
  })

  it('queues edits made while a write is in flight and sends them after', async () => {
    let resolver: (valor: { id: string; version: number }) => void = () => {}
    const guardar = vi
      .fn<Guardar>()
      .mockImplementationOnce(
        () =>
          new Promise<{ id: string; version: number }>((resolve) => {
            resolver = resolve
          }),
      )
      .mockResolvedValueOnce({ id: 'remoto', version: 2 })
    const { sincronizador, confirmados } = crear(guardar)
    sincronizador.encolar({ ...base, asunto: 'primero' })
    await vi.advanceTimersByTimeAsync(2000)
    expect(guardar).toHaveBeenCalledTimes(1)
    sincronizador.encolar({ ...base, asunto: 'segundo' })
    resolver({ id: 'remoto', version: 1 })
    await vi.runAllTimersAsync()
    expect(guardar).toHaveBeenCalledTimes(2)
    expect(guardar.mock.calls[1][0]).toEqual({
      datos: { ...base, asunto: 'segundo' },
      id: 'remoto',
      version: 1,
    })
    expect(confirmados.at(-1)).toEqual({ id: 'remoto', version: 2 })
  })

  it('retries a lost creation response with the exact original snapshot', async () => {
    const guardar = vi
      .fn<Guardar>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ id: 'remoto', version: 1 })
    const { sincronizador, estados } = crear(guardar)
    const primero = { ...base, asunto: 'snapshot' }
    sincronizador.encolar(primero)
    await vi.advanceTimersByTimeAsync(2000)
    expect(estados).toContain('sin-conexion')
    sincronizador.encolar({ ...base, asunto: 'cambio posterior' })
    await vi.runAllTimersAsync()
    expect(guardar).toHaveBeenCalledTimes(2)
    expect(guardar.mock.calls[1][0]).toEqual({ datos: primero })
  })

  it('reports a conflict without overwriting and preserves pending edits', async () => {
    const guardar = vi
      .fn<Guardar>()
      .mockRejectedValueOnce(new ApiError(409, 'El borrador fue modificado en otra sesión'))
      .mockResolvedValueOnce({ id: 'remoto', version: 9 })
    const { sincronizador, estados } = crear(guardar)
    sincronizador.inicializar('remoto', 1)
    sincronizador.encolar({ ...base, asunto: 'mío' })
    await vi.advanceTimersByTimeAsync(2000)
    expect(estados).toContain('conflicto')
    await expect(sincronizador.enviarAhora()).rejects.toBeInstanceOf(ConflictoBorradorError)
    expect(guardar).toHaveBeenCalledTimes(1)
    sincronizador.reintentar()
    await vi.runAllTimersAsync()
    expect(guardar).toHaveBeenCalledTimes(1)
    sincronizador.resolverCon(2)
    await vi.runAllTimersAsync()
    expect(guardar.mock.calls[1][0]).toEqual({
      datos: { ...base, asunto: 'mío' },
      id: 'remoto',
      version: 2,
    })
  })

  it('waits for pending writes on demand so publication uses the confirmed version', async () => {
    const guardar = vi.fn<Guardar>().mockResolvedValue({ id: 'remoto', version: 3 })
    const { sincronizador } = crear(guardar)
    sincronizador.encolar({ ...base, asunto: 'publicar' })
    await expect(sincronizador.enviarAhora()).resolves.toEqual({ id: 'remoto', version: 3 })
    expect(guardar).toHaveBeenCalledTimes(1)
  })
})
