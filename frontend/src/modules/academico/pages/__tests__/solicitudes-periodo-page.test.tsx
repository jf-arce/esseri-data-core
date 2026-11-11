import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SolicitudesPeriodoPage } from '@/modules/academico/pages/solicitudes-periodo-page'
import {
  listarSolicitudesPeriodo,
  resolverSolicitudPeriodo,
  revocarSolicitudPeriodo,
} from '@/modules/academico/services/solicitudes-periodo-admin'
import type { SolicitudAusenciaPeriodoAdmin } from '@/modules/academico/types'

vi.mock('@/modules/academico/services/solicitudes-periodo-admin')

const mockedListar = vi.mocked(listarSolicitudesPeriodo)
const mockedResolver = vi.mocked(resolverSolicitudPeriodo)
const mockedRevocar = vi.mocked(revocarSolicitudPeriodo)

function crearSolicitud(
  overrides: Partial<SolicitudAusenciaPeriodoAdmin>,
): SolicitudAusenciaPeriodoAdmin {
  return {
    id: 'solicitud',
    alumno_id: 'alumno-1',
    alumno_nombre: 'Alumno',
    familia_id: 'familia-1',
    fecha_inicio: '2027-03-01',
    fecha_fin: '2027-03-05',
    estado: 'pendiente',
    motivo: 'enfermedad',
    observacion: null,
    observacion_resolucion: null,
    archivo_nombre: null,
    fecha_carga: '2027-03-01T08:00:00',
    fecha_resolucion: null,
    ...overrides,
  }
}

const pendiente = crearSolicitud({
  id: 'sol-pendiente',
  alumno_nombre: 'Alumno Pendiente',
})
const aprobada = crearSolicitud({
  id: 'sol-aprobada',
  alumno_nombre: 'Alumno Aprobado',
  estado: 'aprobada',
  fecha_resolucion: '2027-03-02T08:00:00',
})

describe('SolicitudesPeriodoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedListar.mockResolvedValue({
      items: [pendiente, aprobada],
      total: 2,
      pagina: 1,
      tamanio_pagina: 20,
      total_paginas: 1,
      resumen: {
        pendientes: 1,
        aprobadas: 1,
        rechazadas: 0,
        canceladas: 0,
        revocadas: 0,
        total: 2,
      },
    })
    mockedResolver.mockResolvedValue(pendiente)
    mockedRevocar.mockResolvedValue(aprobada)
  })

  it('aprueba, rechaza con motivo y revoca con aviso opcional', async () => {
    render(
      <MemoryRouter>
        <SolicitudesPeriodoPage />
      </MemoryRouter>,
    )

    await screen.findByText('Alumno Pendiente')
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar' }))
    await waitFor(() => expect(mockedResolver).toHaveBeenCalledWith('sol-pendiente', true))

    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }))
    fireEvent.change(screen.getByLabelText(/Motivo del rechazo/), {
      target: { value: 'No corresponde' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar rechazo' }))
    await waitFor(() =>
      expect(mockedResolver).toHaveBeenCalledWith('sol-pendiente', false, 'No corresponde'),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Revocar' }))
    fireEvent.change(screen.getByLabelText(/Motivo de la revocación/), {
      target: { value: 'Error administrativo' },
    })
    fireEvent.click(screen.getByLabelText('Notificar a la familia con este motivo'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar revocación' }))
    await waitFor(() =>
      expect(mockedRevocar).toHaveBeenCalledWith('sol-aprobada', 'Error administrativo', true),
    )
  })
})
