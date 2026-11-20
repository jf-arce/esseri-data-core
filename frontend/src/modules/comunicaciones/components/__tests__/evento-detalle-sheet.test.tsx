import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, it, vi } from 'vitest'
import type { EventoCalendario } from '../../types'
import { EventoDetalleSheet } from '../evento-detalle-sheet'

const evento: EventoCalendario = {
  comunicacion_id: 'c1',
  titulo: 'Reunión de padres',
  fecha: '2026-11-27',
  hora_inicio: '18:00',
  hora_fin: '19:30',
  lugar: 'Biblioteca',
  descripcion: 'Traer el boletín.',
}

function renderizar(props: Partial<Parameters<typeof EventoDetalleSheet>[0]> = {}) {
  return render(
    <MemoryRouter>
      <EventoDetalleSheet
        evento={evento}
        coincidencias={[]}
        onCerrar={props.onCerrar ?? vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  )
}

it('shows date, time, place and description of the event', async () => {
  renderizar()

  const panel = await screen.findByRole('dialog')
  expect(panel).toHaveTextContent('Reunión de padres')
  expect(panel).toHaveTextContent('Evento del colegio')
  expect(panel).toHaveTextContent('viernes 27 de noviembre')
  expect(panel).toHaveTextContent('18:00 a 19:30')
  expect(panel).toHaveTextContent('Biblioteca')
  expect(panel).toHaveTextContent('Traer el boletín.')
})

it('links to the related communication', async () => {
  renderizar()

  expect(await screen.findByRole('link', { name: /Ver comunicación relacionada/ })).toHaveAttribute(
    'href',
    '/familia/comunicaciones/c1',
  )
})

it('reports the overlap without claiming the class is cancelled', async () => {
  renderizar({
    coincidencias: [{ id: 'clase-1', titulo: 'Inglés', detalle: '10:20 a 11:20', tipo: 'clase' }],
  })

  const panel = await screen.findByRole('dialog')
  expect(panel).toHaveTextContent('Se superpone con otra actividad')
  expect(panel).toHaveTextContent('Inglés')
  expect(panel).toHaveTextContent('10:20 a 11:20')
  expect(panel).toHaveTextContent('las clases del horario se mantienen')
  expect(panel).not.toHaveTextContent(/cancelad|reemplaz/i)
})

it('closes from the close button', async () => {
  const onCerrar = vi.fn()
  const usuario = userEvent.setup()
  renderizar({ onCerrar })

  await usuario.click(await screen.findByRole('button', { name: 'Cerrar' }))
  expect(onCerrar).toHaveBeenCalled()
})

it('closes with Escape', async () => {
  const onCerrar = vi.fn()
  const usuario = userEvent.setup()
  renderizar({ onCerrar })

  await screen.findByRole('dialog')
  await usuario.keyboard('{Escape}')
  expect(onCerrar).toHaveBeenCalled()
})

it('stays closed without an event', () => {
  renderizar({ evento: null })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
