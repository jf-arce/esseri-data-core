import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebitosSeleccion } from '@/modules/facturacion/hooks/use-debitos-seleccion'
import { resumirSeleccionDebitos } from '@/modules/facturacion/services/resumir-seleccion-debitos'
import type { ResumenSeleccionDebitos } from '@/modules/facturacion/types'

vi.mock('@/modules/facturacion/services/resumir-seleccion-debitos')

function resumen(alcance: 'pagina' | 'filtrados', cantidad = 25): ResumenSeleccionDebitos {
  return {
    cantidad,
    importe_total: String(cantidad * 1000),
    por_medio: {
      cbu: { cantidad: Math.ceil(cantidad / 2), importe: String(Math.ceil(cantidad / 2) * 1000) },
      tarjeta: {
        cantidad: Math.floor(cantidad / 2),
        importe: String(Math.floor(cantidad / 2) * 1000),
      },
    },
    alcance,
    ocultas_en_lote: 12,
  }
}

const filtros = { periodo: '2026-10', estado: 'pendientes_sin_lote' as const }

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(resumirSeleccionDebitos).mockImplementation(async ({ modo, factura_ids }) =>
    modo === 'pagina'
      ? resumen('pagina', factura_ids.length)
      : resumen('filtrados', 438),
  )
})

describe('useDebitosSeleccion', () => {
  it('las filas seleccionadas envían exactamente sus IDs y nada del resto del filtro', async () => {
    const { result } = renderHook(() =>
      useDebitosSeleccion({
        total: 438,
        pagina: 1,
        filtros,
        claveFiltros: '2026-10|todos|pendientes_sin_lote|',
      }),
    )

    await waitFor(() => expect(result.current.resumen.cantidad).toBe(0))
    act(() => result.current.alternarFila('factura-3', true))
    act(() => result.current.alternarFila('factura-7', true))

    await waitFor(() => expect(result.current.resumen.cantidad).toBe(2))

    const ultima = vi.mocked(resumirSeleccionDebitos).mock.calls.at(-1)?.[0]
    expect(ultima).toMatchObject({
      modo: 'pagina',
      factura_ids: ['factura-3', 'factura-7'],
    })
    expect(result.current.modo).toBe('pagina')
    expect(result.current.seleccionadas).toEqual(['factura-3', 'factura-7'])
  })

  it('seleccionar los filtrados usa el predicado y no cientos de IDs', async () => {
    const { result } = renderHook(() =>
      useDebitosSeleccion({
        total: 438,
        pagina: 1,
        filtros,
        claveFiltros: '2026-10|todos|pendientes_sin_lote|',
      }),
    )

    await waitFor(() => expect(result.current.resumen.cantidad).toBe(0))
    act(() => result.current.seleccionarFiltrados())

    await waitFor(() => expect(result.current.resumen.cantidad).toBe(438))

    const ultima = vi.mocked(resumirSeleccionDebitos).mock.calls.at(-1)?.[0]
    expect(ultima).toEqual({
      modo: 'filtrados',
      factura_ids: [],
      filtros,
      excluir_ids: [],
    })
    expect(result.current.modo).toBe('filtrados')
  })

  it('la selección global sobrevive el cambio de página y la de filas no', async () => {
    const { result, rerender } = renderHook(
      ({ pagina }) =>
        useDebitosSeleccion({
          total: 438,
          pagina,
          filtros,
          claveFiltros: '2026-10|todos|pendientes_sin_lote|',
        }),
      { initialProps: { pagina: 1 } },
    )

    await waitFor(() => expect(result.current.resumen.cantidad).toBe(0))
    act(() => result.current.alternarFila('factura-1', true))
    await waitFor(() => expect(result.current.seleccionadas).toEqual(['factura-1']))

    rerender({ pagina: 2 })
    await waitFor(() => expect(result.current.seleccionadas).toHaveLength(0))

    act(() => result.current.seleccionarFiltrados())
    await waitFor(() => expect(result.current.modo).toBe('filtrados'))

    rerender({ pagina: 3 })
    await waitFor(() => expect(result.current.modo).toBe('filtrados'))
    expect(result.current.resumen.cantidad).toBe(438)
  })

  it('cambiar filtros o búsqueda limpia la selección global', async () => {
    const { result, rerender } = renderHook(
      ({ clave }) =>
        useDebitosSeleccion({
          total: 438,
          pagina: 1,
          filtros,
          claveFiltros: clave,
        }),
      { initialProps: { clave: '2026-10|todos|pendientes_sin_lote|' } },
    )

    await waitFor(() => expect(result.current.resumen.cantidad).toBe(0))
    act(() => result.current.seleccionarFiltrados())
    await waitFor(() => expect(result.current.modo).toBe('filtrados'))

    rerender({ clave: '2026-10|todos|pendientes_sin_lote|García' })

    await waitFor(() => expect(result.current.modo).toBe('pagina'))
    expect(result.current.seleccionadas).toHaveLength(0)
    expect(result.current.excluidos).toHaveLength(0)
  })

  it('permite excluir una fila de la selección global sin enumerar el resto', async () => {
    const { result } = renderHook(() =>
      useDebitosSeleccion({
        total: 438,
        pagina: 1,
        filtros,
        claveFiltros: '2026-10|todos|pendientes_sin_lote|',
      }),
    )

    await waitFor(() => expect(result.current.resumen.cantidad).toBe(0))
    act(() => result.current.seleccionarFiltrados())
    await waitFor(() => expect(result.current.modo).toBe('filtrados'))

    act(() => result.current.alternarFila('factura-2', false))

    await waitFor(() => expect(result.current.excluidos).toEqual(['factura-2']))
    const ultima = vi.mocked(resumirSeleccionDebitos).mock.calls.at(-1)?.[0]
    expect(ultima).toMatchObject({ modo: 'filtrados', excluir_ids: ['factura-2'] })
  })

  it('no resucita la selección de página al volver al filtro anterior', async () => {
    const filtrosPeriodoA = {
      periodo: '2026-10',
      medio: 'cbu' as const,
      estado: 'pendientes_sin_lote' as const,
    }
    const { result, rerender } = renderHook(
      ({ clave, filtrosActuales }) =>
        useDebitosSeleccion({
          total: 438,
          pagina: 1,
          filtros: filtrosActuales,
          claveFiltros: clave,
        }),
      {
        initialProps: {
          clave: '2026-10|cbu|pendientes_sin_lote|',
          filtrosActuales: filtrosPeriodoA,
        },
      },
    )

    await waitFor(() => expect(result.current.resumen.cantidad).toBe(0))
    act(() => result.current.alternarFila('factura-1', true))
    await waitFor(() => expect(result.current.seleccionadas).toEqual(['factura-1']))

    rerender({
      clave: '2026-09|cbu|pendientes_sin_lote|',
      filtrosActuales: { ...filtrosPeriodoA, periodo: '2026-09' },
    })
    await waitFor(() => expect(result.current.seleccionadas).toHaveLength(0))

    rerender({
      clave: '2026-10|cbu|pendientes_sin_lote|',
      filtrosActuales: filtrosPeriodoA,
    })

    await waitFor(() => expect(result.current.seleccionadas).toHaveLength(0))
    expect(result.current.modo).toBe('pagina')
    expect(result.current.seleccion).toMatchObject({
      modo: 'pagina',
      factura_ids: [],
      excluir_ids: [],
    })
  })

  it('no resucita la selección filtrada ni sus exclusiones al volver al filtro anterior', async () => {
    const filtrosPeriodoA = {
      periodo: '2026-10',
      medio: 'cbu' as const,
      estado: 'pendientes_sin_lote' as const,
    }
    const { result, rerender } = renderHook(
      ({ clave, filtrosActuales }) =>
        useDebitosSeleccion({
          total: 438,
          pagina: 1,
          filtros: filtrosActuales,
          claveFiltros: clave,
        }),
      {
        initialProps: {
          clave: '2026-10|cbu|pendientes_sin_lote|',
          filtrosActuales: filtrosPeriodoA,
        },
      },
    )

    await waitFor(() => expect(result.current.resumen.cantidad).toBe(0))
    act(() => result.current.seleccionarFiltrados())
    await waitFor(() => expect(result.current.modo).toBe('filtrados'))
    act(() => result.current.alternarFila('factura-2', false))
    await waitFor(() => expect(result.current.excluidos).toEqual(['factura-2']))

    rerender({
      clave: '2026-09|cbu|pendientes_sin_lote|',
      filtrosActuales: { ...filtrosPeriodoA, periodo: '2026-09' },
    })
    await waitFor(() => expect(result.current.modo).toBe('pagina'))
    await waitFor(() => expect(result.current.excluidos).toHaveLength(0))

    rerender({
      clave: '2026-10|cbu|pendientes_sin_lote|',
      filtrosActuales: filtrosPeriodoA,
    })

    await waitFor(() => expect(result.current.modo).toBe('pagina'))
    expect(result.current.seleccionadas).toHaveLength(0)
    expect(result.current.excluidos).toHaveLength(0)
    expect(result.current.seleccion).toMatchObject({
      modo: 'pagina',
      factura_ids: [],
      excluir_ids: [],
    })
    await waitFor(() =>
      expect(vi.mocked(resumirSeleccionDebitos).mock.calls.at(-1)?.[0]).toMatchObject({
        modo: 'pagina',
        factura_ids: [],
        excluir_ids: [],
      }),
    )
  })
})
