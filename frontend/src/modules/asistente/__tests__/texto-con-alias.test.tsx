import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it } from 'vitest'
import { TextoConAlias } from '../components/texto-con-alias'

it('reemplaza el alias por el nombre con link a la ficha cuando está resuelto', () => {
  render(
    <MemoryRouter>
      <TextoConAlias
        texto="Hablá con [ALUMNO:1] hoy"
        porAlias={{
          '[ALUMNO:1]': {
            alias: '[ALUMNO:1]',
            tipo: 'ALUMNO',
            entidad_id: 'abc',
            nombre: 'Quintero, Mariana',
          },
        }}
      />
    </MemoryRouter>,
  )

  expect(screen.getByRole('link', { name: 'Mariana Quintero' })).toHaveAttribute(
    'href',
    '/familias-alumnos/alumnos/abc',
  )
  expect(screen.queryByText(/\[ALUMNO/)).not.toBeInTheDocument()
})

it('muestra una etiqueta genérica, sin link, mientras el alias no se resolvió', () => {
  render(
    <MemoryRouter>
      <TextoConAlias texto="Mirá a [FAMILIA:2]" porAlias={{}} />
    </MemoryRouter>,
  )

  expect(screen.getByText('Familia 2')).toBeInTheDocument()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})
