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
    mockedApiClient.mockResolvedValue([])
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
