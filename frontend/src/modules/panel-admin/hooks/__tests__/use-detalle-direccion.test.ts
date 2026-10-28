import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { listarAsistencias } from '@/modules/academico/services/asistencias'
import { listarDeudaFamilias } from '@/modules/facturacion/services/listar-deuda-familias'
import { listarSolicitudes } from '@/modules/proveedores-compras/services/listar-solicitudes'
import { useDetalleDireccion } from '../use-detalle-direccion'

vi.mock('@/api/client', () => ({ apiClient: vi.fn() }))
vi.mock('@/modules/academico/services/asistencias', () => ({ listarAsistencias: vi.fn() }))
vi.mock('@/modules/facturacion/services/listar-deuda-familias', () => ({
  listarDeudaFamilias: vi.fn(),
}))
vi.mock('@/modules/proveedores-compras/services/listar-solicitudes', () => ({
  listarSolicitudes: vi.fn(),
}))

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(apiClient).mockResolvedValue([])
  vi.mocked(listarAsistencias).mockResolvedValue([])
  vi.mocked(listarDeudaFamilias).mockResolvedValue({ items: [], total: 0, pagina: 1, tamanio: 5 })
  vi.mocked(listarSolicitudes).mockResolvedValue([])
})

it('does not request data from modules without permission', () => {
  const { result } = renderHook(() =>
    useDetalleDireccion({ compras: false, finanzas: false, academico: false, alumnos: false }),
  )
  expect(apiClient).not.toHaveBeenCalled()
  expect(listarAsistencias).not.toHaveBeenCalled()
  expect(listarDeudaFamilias).not.toHaveBeenCalled()
  expect(listarSolicitudes).not.toHaveBeenCalled()
  expect(result.current.compras.datos).toBeNull()
  expect(result.current.actividad.datos).toBeNull()
})

it('loads independent sections and limits overdue accounts and attendance dates', async () => {
  vi.mocked(apiClient).mockRejectedValue(new Error('offline'))
  const { result } = renderHook(() =>
    useDetalleDireccion({ compras: true, finanzas: true, academico: true, alumnos: true }),
  )
  await waitFor(() => expect(result.current.finanzas.error).not.toBeNull())
  expect(result.current.compras).toEqual({ datos: [], cargando: false, error: null })
  expect(listarDeudaFamilias).toHaveBeenCalledWith({ estado: 'vencida', pagina: 1, tamanio: 5 })
  expect(listarAsistencias).toHaveBeenCalledWith({
    fecha_desde: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    fecha_hasta: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  })
  expect(result.current.finanzas.datos).toBeNull()
})
