import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

const estado = vi.hoisted(() => ({
  sugerencias: [
    { clave: 'ALUMNO:1', tipo: 'ALUMNO', id: '1', nombre: 'Ana Roca' },
    { clave: 'DOCENTE:2', tipo: 'DOCENTE', id: '2', nombre: 'Marta Díaz' },
    { clave: 'CURSO:3', tipo: 'CURSO', id: '3', nombre: '3°A de Primario' },
  ],
}))
vi.mock('../hooks/use-sugerencias-mencion', () => ({
  useSugerenciasMencion: () => ({ sugerencias: estado.sugerencias, buscando: false }),
}))

import { EntradaMensaje } from '../components/entrada-mensaje'

it('se pueden elegir varios seguidos, cada uno con su @', async () => {
  const onFijar = vi.fn()
  render(
    <EntradaMensaje
      abierto
      generando={false}
      puedeMencionar
      onEnviar={vi.fn()}
      onCancelar={vi.fn()}
      mencionPendiente={null}
      onMencionAplicada={vi.fn()}
      onFijar={onFijar}
    />,
  )
  const campo = screen.getByRole('textbox')
  const usuario = userEvent.setup()

  await usuario.type(campo, '@a')
  await usuario.click(await screen.findByText('Ana Roca'))
  expect(campo).toHaveValue('')

  await usuario.type(campo, '@m')
  await usuario.click(await screen.findByText('Marta Díaz'))

  await usuario.type(campo, '@3')
  await usuario.click(await screen.findByText('3°A de Primario'))

  expect(onFijar.mock.calls.map(([sugerencia]) => sugerencia.nombre)).toEqual([
    'Ana Roca',
    'Marta Díaz',
    '3°A de Primario',
  ])
})
