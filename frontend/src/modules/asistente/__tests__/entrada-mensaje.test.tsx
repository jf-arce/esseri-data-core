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

it('al elegir un atajo lo resalta y, sin texto, manda su pregunta por defecto', async () => {
  const onEnviar = vi.fn()
  render(
    <EntradaMensaje abierto {...propiedades} permisos={permisosDeDireccion} onEnviar={onEnviar} />,
  )
  const campo = screen.getByRole('textbox', { name: 'Mensaje para el asistente' })
  const usuario = userEvent.setup()

  await usuario.type(campo, '/deu')
  await usuario.click(await screen.findByText('/deuda'))
  expect(campo).toHaveValue('')
  expect(document.querySelector('[data-slot="atajo-resaltado"]')).toHaveTextContent('/deuda')

  await usuario.click(screen.getByRole('button', { name: 'Enviar' }))
  expect(onEnviar).toHaveBeenCalledWith('Familias con mayor deuda vencida', [], 'deuda')
  expect(document.querySelector('[data-slot="atajo-resaltado"]')).toBeNull()
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

it('Backspace con el campo vacío elimina el atajo', async () => {
  const onEnviar = vi.fn()
  render(
    <EntradaMensaje abierto {...propiedades} permisos={permisosDeDireccion} onEnviar={onEnviar} />,
  )
  const campo = screen.getByRole('textbox')
  const usuario = userEvent.setup()
  await usuario.type(campo, '/asis')
  await usuario.keyboard('{Enter}')
  expect(document.querySelector('[data-slot="atajo-resaltado"]')).not.toBeNull()

  await usuario.keyboard('{Backspace}')
  expect(document.querySelector('[data-slot="atajo-resaltado"]')).toBeNull()
  await usuario.type(campo, 'otra cosa')
  await usuario.keyboard('{Enter}')
  expect(onEnviar).toHaveBeenCalledWith('otra cosa', [])
})

it('un modo queda resaltado y manda la pregunta que se escribe después', async () => {
  const onEnviar = vi.fn()
  render(<EntradaMensaje abierto {...propiedades} onEnviar={onEnviar} />)
  const campo = screen.getByRole('textbox')
  const usuario = userEvent.setup()

  await usuario.type(campo, '/comp')
  await usuario.keyboard('{Tab}')
  expect(campo).toHaveValue('')
  expect(document.querySelector('[data-slot="atajo-resaltado"]')).toHaveTextContent('/comparar')

  await usuario.type(campo, 'asistencias de octubre')
  await usuario.keyboard('{Enter}')
  expect(onEnviar).toHaveBeenCalledWith('asistencias de octubre', [], 'comparar')
})

it('un atajo escrito a mano con su espacio también se resalta', async () => {
  render(<EntradaMensaje abierto {...propiedades} />)
  const campo = screen.getByRole('textbox')
  await userEvent.setup().type(campo, '/grafico deuda')
  expect(document.querySelector('[data-slot="atajo-resaltado"]')).toHaveTextContent('/grafico')
  expect(campo).toHaveValue('deuda')
})

it('un modo sin pregunta no se envía', async () => {
  const onEnviar = vi.fn()
  render(<EntradaMensaje abierto {...propiedades} onEnviar={onEnviar} />)
  const usuario = userEvent.setup()
  await usuario.type(screen.getByRole('textbox'), '/comp')
  await usuario.keyboard('{Enter}')
  await usuario.keyboard('{Enter}')
  expect(onEnviar).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
})

it('lo que se elige para mencionar queda también como contexto fijado', async () => {
  const onFijar = vi.fn()
  const sugerencia = {
    clave: 'CURSO:c1',
    tipo: 'CURSO',
    id: 'c1',
    nombre: '3°A de Primario',
  } as const
  render(
    <EntradaMensaje abierto {...propiedades} mencionPendiente={sugerencia} onFijar={onFijar} />,
  )
  await waitFor(() => expect(onFijar).toHaveBeenCalledWith(sugerencia))
  expect(screen.getByRole('textbox')).toHaveValue('@3°A de Primario ')
})
