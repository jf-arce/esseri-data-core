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

  it('informa cuando no hay justificaciones pendientes', async () => {
    render(
      <MemoryRouter>
        <JustificacionesPage />
      </MemoryRouter>,
    )

    expect(
      await screen.findByText('No hay justificaciones pendientes para revisar.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Justificaciones' })).toBeInTheDocument()
  })
})
