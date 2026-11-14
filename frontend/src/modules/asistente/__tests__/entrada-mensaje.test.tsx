import { render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { EntradaMensaje } from '../components/entrada-mensaje'

const propiedades = {
  generando: false,
  puedeMencionar: false,
  onEnviar: vi.fn(),
  onCancelar: vi.fn(),
  mencionPendiente: null,
  onMencionAplicada: vi.fn(),
}

it('al abrirse pone el cursor en el cuadro de texto', async () => {
  const { rerender } = render(<EntradaMensaje abierto={false} {...propiedades} />)
  const campo = screen.getByRole('textbox', { name: 'Mensaje para el asistente' })
  expect(campo).not.toHaveFocus()

  rerender(<EntradaMensaje abierto {...propiedades} />)

  await waitFor(() => expect(campo).toHaveFocus())
})
