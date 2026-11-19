import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ConfigAccionCampos } from '@/modules/workflows/components/config-accion-campos'

it('ofrece Portal, Email y Ambos y guarda el canal elegido', async () => {
  const onCambiar = vi.fn()
  const usuario = userEvent.setup()
  render(
    <ConfigAccionCampos
      tipoAccion="publicar_comunicacion"
      valores={{ canal: 'email' }}
      contexto={{
        estadosPermitidos: [],
        camposNumericos: [],
        conceptos: [],
        deshabilitado: false,
      }}
      onCambiar={onCambiar}
    />,
  )

  const selector = screen.getByRole('combobox', { name: 'Canal de publicación' })
  expect(selector).toHaveTextContent('Email')
  await usuario.click(selector)
  expect(screen.getByRole('option', { name: 'Portal' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Email' })).toBeInTheDocument()
  await usuario.click(screen.getByRole('option', { name: 'Ambos' }))
  expect(onCambiar).toHaveBeenCalledWith('canal', 'ambos')
})
