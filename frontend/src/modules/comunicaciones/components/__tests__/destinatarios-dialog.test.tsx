import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { DestinatariosDialog } from '../destinatarios-dialog'

vi.mock('@/api/client')
const api = vi.mocked(apiClient)
const personas = Array.from({ length: 23 }, (_, indice) => ({
  id: String(indice),
  nombre: `Persona ${String(indice + 1).padStart(2, '0')}`,
  email: null,
  estado: null,
}))

beforeEach(() => {
  vi.resetAllMocks()
  api.mockImplementation(async (path) => {
    const query = new URL(String(path), 'https://example.test').searchParams
    const pagina = Number(query.get('pagina') ?? '1')
    const filtradas = personas.filter((persona) =>
      persona.nombre.includes(query.get('buscar') ?? ''),
    )
    return {
      items: filtradas.slice((pagina - 1) * 10, pagina * 10),
      total: filtradas.length,
      pagina,
      total_paginas: Math.ceil(filtradas.length / 10),
    }
  })
})

it('loads only when opened, paginates by ten and searches the whole list', async () => {
  render(<DestinatariosDialog comunicacionId="c1" etiqueta="23 destinatarios" />)
  expect(api).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: '23 destinatarios' }))
  let lista = await screen.findByRole('list', { name: 'Lista de destinatarios' })
  expect(within(lista).getAllByRole('listitem')).toHaveLength(10)
  await userEvent.click(screen.getByRole('link', { name: '2' }))
  await screen.findByText('Persona 11')
  lista = screen.getByRole('list', { name: 'Lista de destinatarios' })
  expect(within(lista).getAllByRole('listitem')).toHaveLength(10)
  await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar destinatarios' }), '23')
  await screen.findByText('Persona 23')
  lista = screen.getByRole('list', { name: 'Lista de destinatarios' })
  expect(within(lista).getAllByRole('listitem')).toHaveLength(1)
  expect(screen.queryByRole('link', { name: '2' })).not.toBeInTheDocument()
  expect(String(api.mock.calls.at(-1)?.[0])).toContain('pagina=1&buscar=23')
  await userEvent.clear(screen.getByRole('searchbox'))
  await screen.findByText('Persona 01')
  await userEvent.click(screen.getByRole('link', { name: '3' }))
  await screen.findByText('Persona 21')
  expect(
    within(screen.getByRole('list', { name: 'Lista de destinatarios' })).getAllByRole('listitem'),
  ).toHaveLength(3)
})

it('uses the teacher sent filter and recovers from load errors', async () => {
  api.mockRejectedValueOnce(new Error('denied'))
  render(
    <DestinatariosDialog comunicacionId="c1" docente vista="enviados" etiqueta="23 enviados" />,
  )
  await userEvent.click(screen.getByRole('button', { name: '23 enviados' }))
  await screen.findByText('No se pudo cargar la lista.')
  expect(String(api.mock.calls[0][0])).toContain(
    '/comunicaciones/docente/c1/destinatarios?vista=enviados',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  await screen.findByText('Persona 01')
  await userEvent.type(screen.getByRole('searchbox'), 'nadie')
  expect(await screen.findByText('No hay coincidencias para esta búsqueda.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  await userEvent.click(screen.getByRole('button', { name: '23 enviados' }))
  expect(await screen.findByText('Persona 01')).toBeInTheDocument()
  expect(screen.getByRole('searchbox')).toHaveValue('')
})
