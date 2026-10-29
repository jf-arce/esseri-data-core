import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { consultarHistorial } from '../../services/consultar-historial'
import { useConsultaHistorial } from '../use-consulta-historial'

vi.mock('../../services/consultar-historial')

it('passes all filters and ignores an older response after the cycle changes', async () => {
  let completar!: (datos: never) => void
  vi.mocked(consultarHistorial).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        completar = resolve
      }),
  )
  const datos = {
    items: [],
    total: 0,
    pagina: 1,
    tamanio_pagina: 20,
    total_paginas: 0,
    resumen: {
      total_registros: 0,
      presentes: 0,
      ausentes_justificadas: 0,
      ausentes_injustificadas: 0,
      porcentaje_presencia: 0,
    },
  }
  vi.mocked(consultarHistorial).mockResolvedValue(datos)
  const { result, rerender } = renderHook(
    ({ ciclo }) => useConsultaHistorial({ ciclo_lectivo: ciclo, estado: 'presente', pagina: 1 }),
    { initialProps: { ciclo: '2026' } },
  )
  rerender({ ciclo: '2025' })
  await waitFor(() => expect(result.current.datos).toEqual(datos))
  expect(consultarHistorial).toHaveBeenLastCalledWith({
    ciclo_lectivo: '2025',
    estado: 'presente',
    pagina: 1,
  })
  await act(async () => completar({ ...datos, total: 999 } as never))
  expect(result.current.datos?.total).toBe(0)
})

it('clears previous data on a rejected filtered request and exposes permission errors', async () => {
  vi.mocked(consultarHistorial).mockRejectedValue(new ApiError(403, 'Sin permiso'))
  const { result } = renderHook(() => useConsultaHistorial({ ciclo_lectivo: '2026' }))
  await waitFor(() => expect(result.current.cargando).toBe(false))
  expect(result.current.datos).toBeNull()
  expect(result.current.sinPermiso).toBe(true)
})
