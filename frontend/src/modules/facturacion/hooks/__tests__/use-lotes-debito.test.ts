import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useLoteDebitoDetalle } from '@/modules/facturacion/hooks/use-lotes-debito'
import { obtenerLoteDebitos } from '@/modules/facturacion/services/obtener-lote-debitos'
import type { LoteDebitoDetalle } from '@/modules/facturacion/types'

vi.mock('@/modules/facturacion/services/obtener-lote-debitos')

function diferido<T>() {
  let resolver!: (valor: T) => void
  let rechazar!: (motivo?: unknown) => void
  const promesa = new Promise<T>((resolve, reject) => {
    resolver = resolve
    rechazar = reject
  })
  return { promesa, resolver, rechazar }
}

function detalle(id: string, codigo: string, importe: string): LoteDebitoDetalle {
  return {
    id,
    codigo,
    fecha_exportacion: '2026-10-10',
    periodo: '2026-10',
    cantidad_facturas: 1,
    importe_total: importe,
    estado: 'pagos_registrados',
    resultados_importados: true,
    importacion_id: `imp-${id}`,
    liberacion: null,
    items: [],
    solicitudes: [{ nombre: `${codigo}.txt`, contenido: '' }],
  }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('useLoteDebitoDetalle', () => {
  it('ignora la respuesta tardía de un lote anterior cuando se abre otro', async () => {
    const lentoA = diferido<LoteDebitoDetalle>()
    const loteB = diferido<LoteDebitoDetalle>()
    vi.mocked(obtenerLoteDebitos).mockImplementation((loteId) =>
      loteId === 'lote-a' ? lentoA.promesa : loteB.promesa,
    )
    const { result } = renderHook(() => useLoteDebitoDetalle())

    act(() => {
      void result.current.cargar('lote-a')
    })
    act(() => {
      void result.current.cargar('lote-b')
    })

    const senalA = vi.mocked(obtenerLoteDebitos).mock.calls[0][1]

    await act(async () => {
      loteB.resolver(detalle('lote-b', 'LD-B', '2000.00'))
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.detalle?.id).toBe('lote-b'))

    await act(async () => {
      lentoA.resolver(detalle('lote-a', 'LD-A', '1000.00'))
      await Promise.resolve()
    })

    expect(result.current.detalle?.id).toBe('lote-b')
    expect(result.current.detalle?.importe_total).toBe('2000.00')
    expect(result.current.cargando).toBe(false)
    expect(senalA?.aborted).toBe(true)
  })

  it('ignora una respuesta vieja al cerrar y reabrir el mismo lote', async () => {
    const primera = diferido<LoteDebitoDetalle>()
    const segunda = diferido<LoteDebitoDetalle>()
    vi.mocked(obtenerLoteDebitos)
      .mockImplementationOnce(() => primera.promesa)
      .mockImplementationOnce(() => segunda.promesa)
    const { result } = renderHook(() => useLoteDebitoDetalle())

    act(() => {
      void result.current.cargar('lote-a')
    })
    act(() => result.current.limpiar())
    act(() => {
      void result.current.cargar('lote-a')
    })

    const primeraSenal = vi.mocked(obtenerLoteDebitos).mock.calls[0][1]

    await act(async () => {
      segunda.resolver(detalle('lote-a', 'LD-A', '2200.00'))
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.detalle?.importe_total).toBe('2200.00'))

    await act(async () => {
      primera.resolver(detalle('lote-a', 'LD-A', '1000.00'))
      await Promise.resolve()
    })

    expect(result.current.detalle?.importe_total).toBe('2200.00')
    expect(primeraSenal?.aborted).toBe(true)
  })

  it('no expone el error de una solicitud vieja sobre la solicitud vigente', async () => {
    const fallaA = diferido<LoteDebitoDetalle>()
    const loteB = diferido<LoteDebitoDetalle>()
    vi.mocked(obtenerLoteDebitos).mockImplementation((loteId) =>
      loteId === 'lote-a' ? fallaA.promesa : loteB.promesa,
    )
    const { result } = renderHook(() => useLoteDebitoDetalle())

    act(() => {
      void result.current.cargar('lote-a')
    })
    act(() => {
      void result.current.cargar('lote-b')
    })

    await act(async () => {
      fallaA.rechazar(new Error('Falló el lote A.'))
      await Promise.resolve()
    })

    expect(result.current.error).toBe('')
    expect(result.current.cargando).toBe(true)

    await act(async () => {
      loteB.resolver(detalle('lote-b', 'LD-B', '2000.00'))
      await Promise.resolve()
    })

    await waitFor(() => expect(result.current.detalle?.id).toBe('lote-b'))
    expect(result.current.error).toBe('')
  })

  it('mantiene carga, error y reintento de la solicitud vigente', async () => {
    vi.mocked(obtenerLoteDebitos)
      .mockRejectedValueOnce(new Error('Sin conexión.'))
      .mockResolvedValueOnce(detalle('lote-a', 'LD-A', '1000.00'))
    const { result } = renderHook(() => useLoteDebitoDetalle())

    act(() => {
      void result.current.cargar('lote-a')
    })
    await waitFor(() => expect(result.current.error).toBe('Sin conexión.'))
    expect(result.current.cargando).toBe(false)

    act(() => {
      void result.current.cargar('lote-a')
    })
    await waitFor(() => expect(result.current.detalle?.codigo).toBe('LD-A'))
    expect(result.current.error).toBe('')
    expect(result.current.cargando).toBe(false)
  })

  it('limpiar cancela la solicitud vigente y descarta su respuesta', async () => {
    const lento = diferido<LoteDebitoDetalle>()
    vi.mocked(obtenerLoteDebitos).mockImplementation(() => lento.promesa)
    const { result } = renderHook(() => useLoteDebitoDetalle())

    act(() => {
      void result.current.cargar('lote-a')
    })
    expect(result.current.cargando).toBe(true)

    act(() => result.current.limpiar())
    expect(result.current.cargando).toBe(false)
    expect(result.current.detalle).toBeNull()
    const senal = vi.mocked(obtenerLoteDebitos).mock.calls[0][1]

    await act(async () => {
      lento.resolver(detalle('lote-a', 'LD-A', '1000.00'))
      await Promise.resolve()
    })

    expect(result.current.detalle).toBeNull()
    expect(senal?.aborted).toBe(true)
  })
})
