import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { JustificacionesPage } from '@/modules/academico/pages/justificaciones-page'

vi.mock('@/api/client', () => ({
  apiClient: vi.fn(),
}))

const mockedApiClient = vi.mocked(apiClient)

describe('JustificacionesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedApiClient.mockImplementation(((ruta: string) => {
      if (ruta.includes('/justificaciones/opciones')) return Promise.resolve([])
      if (ruta.includes('/comunicaciones/conversaciones')) {
        return Promise.resolve({ items: [], total: 0 })
      }
      return Promise.resolve({
        items: [],
        total: 0,
        pagina: 1,
        tamanio_pagina: 20,
        total_paginas: 0,
        resumen: { pendientes: 0, aprobadas: 0, rechazadas: 0, total: 0 },
      })
    }) as never)
  })

  it('abre en la pestaña Todas y pide el historial completo', async () => {
    render(
      <MemoryRouter>
        <JustificacionesPage />
      </MemoryRouter>,
    )

    expect(
      await screen.findByText('No hay justificaciones para los filtros seleccionados.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Justificaciones' })).toBeInTheDocument()
    const tabs = screen.getAllByRole('tab')
    expect(tabs[0]).toHaveTextContent('Todas')
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(mockedApiClient).toHaveBeenCalledWith(
      '/academico/justificaciones?pagina=1&tamanio_pagina=20',
    )
  })

  it('resalta y consulta el historial cuando llega desde un aviso', async () => {
    mockedApiClient.mockImplementation(((ruta: string) => {
      if (ruta.includes('/justificaciones/opciones')) return Promise.resolve([])
      if (ruta.includes('/comunicaciones/conversaciones')) {
        return Promise.resolve({ items: [], total: 0 })
      }
      return Promise.resolve({
        items: [
          {
            id: 'just-1',
            alumno_id: 'alumno-1',
            alumno_nombre: 'Gómez, Juan',
            division_nombre: '4° B',
            nivel_educativo_nombre: 'Primario',
            fecha_asistencia: '2026-11-10',
            motivo: 'enfermedad',
            observacion: null,
            estado: 'pendiente',
            fecha_carga: '2026-11-11T10:00:00Z',
            fecha_resolucion: null,
            archivo_nombre: null,
          },
        ],
        total: 1,
        pagina: 1,
        tamanio_pagina: 20,
        total_paginas: 1,
        resumen: { pendientes: 1, aprobadas: 0, rechazadas: 0, total: 1 },
      })
    }) as never)

    render(
      <MemoryRouter initialEntries={['/academico/justificaciones?justificacion=just-1']}>
        <JustificacionesPage />
      </MemoryRouter>,
    )

    const fila = await screen.findByText('Gómez, Juan')
    expect(fila.closest('tr')).toHaveAttribute('aria-current', 'true')
    expect(mockedApiClient).toHaveBeenCalledWith(
      '/academico/justificaciones?pagina=1&tamanio_pagina=20',
    )
  })
})
