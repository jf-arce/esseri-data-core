import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ListaMensajes } from '../components/lista-mensajes'

const propiedades = {
  mensajes: [],
  porAlias: {},
  alElegir: vi.fn(),
  alIr: () => null,
  alReintentar: null,
  sugerencias: ['¿Cómo viene la deuda por familia?'],
  alSugerir: vi.fn(),
}

it('al hacer clic en una sugerencia la manda como pregunta', async () => {
  const alSugerir = vi.fn()
  render(<ListaMensajes {...propiedades} alSugerir={alSugerir} />)

  await userEvent.click(screen.getByRole('button', { name: '¿Cómo viene la deuda por familia?' }))

  expect(alSugerir).toHaveBeenCalledWith('¿Cómo viene la deuda por familia?')
})

it('sin sugerencias no muestra botones', () => {
  render(<ListaMensajes {...propiedades} sugerencias={[]} />)

  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
