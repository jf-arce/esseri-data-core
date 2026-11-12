import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it } from 'vitest'
import { TextoMarkdown } from '../components/texto-markdown'

const resuelto = {
  '[ALUMNO:1]': {
    alias: '[ALUMNO:1]',
    tipo: 'ALUMNO' as const,
    entidad_id: 'abc',
    nombre: 'Quintero, Mariana',
  },
}

it('renderiza negritas, listas y tablas', () => {
  render(
    <MemoryRouter>
      <TextoMarkdown
        texto={'Hay **12** familias:\n\n- una\n- dos\n\n| A | B |\n| - | - |\n| 1 | 2 |'}
        porAlias={{}}
      />
    </MemoryRouter>,
  )
  expect(screen.getByText('12').tagName).toBe('STRONG')
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
  expect(screen.getByRole('table')).toBeInTheDocument()
})

it('el alias resuelto es un link a la ficha', () => {
  render(
    <MemoryRouter>
      <TextoMarkdown texto="Mirá a [ALUMNO:1]" porAlias={resuelto} />
    </MemoryRouter>,
  )
  expect(screen.getByRole('link', { name: 'Quintero, Mariana' })).toHaveAttribute(
    'href',
    '/familias-alumnos/alumnos/abc',
  )
})

it('un link externo armado por el modelo no se vuelve link', () => {
  render(
    <MemoryRouter>
      <TextoMarkdown texto="[click](https://evil.test)" porAlias={{}} />
    </MemoryRouter>,
  )
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  expect(screen.getByText('click')).toBeInTheDocument()
})
