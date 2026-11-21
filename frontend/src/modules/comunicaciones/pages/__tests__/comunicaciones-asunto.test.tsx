import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { ComunicacionesPage } from '../comunicaciones-page'

vi.mock('@/api/client')

it('gives untitled drafts an editable link without changing existing subjects', async () => {
  vi.mocked(apiClient).mockResolvedValue({
    items: [
      { id: 'vacio', asunto: '', estado: 'borrador' },
      { id: 'espacios', asunto: '   ', estado: 'borrador' },
      { id: 'con-titulo', asunto: 'Reunión', estado: 'borrador' },
    ].map((item) => ({
      ...item,
      tipo: 'institucional',
      canal: 'portal',
      created_at: '2026-11-19T00:00:00Z',
    })),
    total: 3,
    pagina: 1,
    total_paginas: 1,
  })

  render(
    <MemoryRouter>
      <ComunicacionesPage />
    </MemoryRouter>,
  )

  const sinAsunto = await screen.findAllByRole('link', { name: 'Sin asunto' })
  expect(sinAsunto.map((link) => link.getAttribute('href'))).toEqual([
    '/comunicaciones/vacio/editar',
    '/comunicaciones/espacios/editar',
  ])
  expect(screen.getByRole('link', { name: 'Reunión' })).toHaveAttribute(
    'href',
    '/comunicaciones/con-titulo/editar',
  )
})
