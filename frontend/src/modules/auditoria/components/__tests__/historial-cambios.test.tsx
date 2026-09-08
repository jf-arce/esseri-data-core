import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { HistorialCambios } from '@/modules/auditoria/components/historial-cambios'
import { obtenerHistorial } from '@/modules/auditoria/services/obtener-historial'
import type { HistorialEntrada } from '@/modules/auditoria/types'

vi.mock('@/modules/auditoria/services/obtener-historial')

const mockedObtenerHistorial = vi.mocked(obtenerHistorial)

const entradaAntigua: HistorialEntrada = {
  id: 'entrada-1',
  campo: 'numero_legajo',
  valor_anterior: '1001',
  valor_nuevo: '1002',
  fecha: '2027-01-01T09:00:00',
  usuario_id: 'usuario-1',
  usuario_email: 'admin@esseri.edu.ar',
}

const entradaReciente: HistorialEntrada = {
  id: 'entrada-2',
  campo: 'estado',
  valor_anterior: 'activo',
  valor_nuevo: 'inactivo',
  fecha: '2027-01-05T10:00:00',
  usuario_id: 'usuario-1',
  usuario_email: 'admin@esseri.edu.ar',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('HistorialCambios', () => {
  it('muestra las entradas del más reciente al más antiguo', async () => {
    mockedObtenerHistorial.mockResolvedValue([entradaAntigua, entradaReciente])

    render(<HistorialCambios entidad="ALUMNO" entidadId="alumno-1" />)

    await waitFor(() =>
      expect(screen.getByText('Estado: "activo" → "inactivo"')).toBeInTheDocument(),
    )
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Estado: "activo" → "inactivo"')
    expect(items[1]).toHaveTextContent('Numero legajo: "1001" → "1002"')
  })

  it('muestra un estado vacío cuando no hay cambios registrados', async () => {
    mockedObtenerHistorial.mockResolvedValue([])

    render(<HistorialCambios entidad="ALUMNO" entidadId="alumno-1" />)

    await waitFor(() => expect(screen.getByText('No hay cambios registrados')).toBeInTheDocument())
  })

  it('muestra un mensaje de permiso cuando el backend responde 403', async () => {
    mockedObtenerHistorial.mockRejectedValue(new ApiError(403, 'Sin permiso'))

    render(<HistorialCambios entidad="ALUMNO" entidadId="alumno-1" />)

    await waitFor(() =>
      expect(
        screen.getByText('No tenés permiso para ver el historial de cambios.'),
      ).toBeInTheDocument(),
    )
  })
})
