import userEvent from '@testing-library/user-event'
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

const permisosDeDireccion = ['facturacion.leer', 'academico.leer', 'panel_administrativo.leer'].map(
  (codigo) => ({
    id: codigo,
    codigo,
    modulo: codigo.split('.')[0],
    accion: 'leer',
    tipo_informacion: null,
  }),
)

it('al escribir / lista los atajos y al elegir uno lo manda con el pedido', async () => {
  const onEnviar = vi.fn()
  render(
    <EntradaMensaje abierto {...propiedades} permisos={permisosDeDireccion} onEnviar={onEnviar} />,
  )
  const campo = screen.getByRole('textbox', { name: 'Mensaje para el asistente' })
  const usuario = userEvent.setup()

  await usuario.type(campo, '/deu')
  await usuario.click(await screen.findByText('/deuda'))
  expect(campo).toHaveValue('Familias con mayor deuda vencida')

  await usuario.click(screen.getByRole('button', { name: 'Enviar' }))
  expect(onEnviar).toHaveBeenCalledWith('Familias con mayor deuda vencida', [], 'deuda')
})

it('no lista los atajos para los que el rol no tiene permiso', async () => {
  render(<EntradaMensaje abierto {...propiedades} permisos={[]} />)
  await userEvent.setup().type(screen.getByRole('textbox'), '/')
  expect(await screen.findByText('/nueva')).toBeVisible()
  expect(screen.queryByText('/deuda')).not.toBeInTheDocument()
})

it('/nueva limpia el campo y abre una conversación nueva sin enviar nada', async () => {
  const onNueva = vi.fn()
  const onEnviar = vi.fn()
  render(<EntradaMensaje abierto {...propiedades} onNueva={onNueva} onEnviar={onEnviar} />)
  const campo = screen.getByRole('textbox')
  const usuario = userEvent.setup()
  await usuario.type(campo, '/nu')
  await usuario.keyboard('{Enter}')
  expect(onNueva).toHaveBeenCalledTimes(1)
  expect(onEnviar).not.toHaveBeenCalled()
  expect(campo).toHaveValue('')
})

it('si se reescribe el mensaje del atajo, viaja sin atajo', async () => {
  const onEnviar = vi.fn()
  render(
    <EntradaMensaje abierto {...propiedades} permisos={permisosDeDireccion} onEnviar={onEnviar} />,
  )
  const campo = screen.getByRole('textbox')
  const usuario = userEvent.setup()
  await usuario.type(campo, '/asis')
  await usuario.keyboard('{Enter}')
  await usuario.clear(campo)
  await usuario.type(campo, 'otra cosa')
  await usuario.keyboard('{Enter}')
  expect(onEnviar).toHaveBeenCalledWith('otra cosa', [])
})
