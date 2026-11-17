import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

const estado = vi.hoisted(() => ({
  buscando: true,
  sugerencias: [] as { clave: string; tipo: string; id: string; nombre: string }[],
}))
vi.mock('../hooks/use-sugerencias-mencion', () => ({
  useSugerenciasMencion: () => estado,
}))

import { EntradaMensaje } from '../components/entrada-mensaje'

const propiedades = {
  abierto: true,
  generando: false,
  puedeMencionar: true,
  onEnviar: vi.fn(),
  onCancelar: vi.fn(),
  mencionPendiente: null,
  onMencionAplicada: vi.fn(),
}

beforeEach(() => {
  estado.buscando = true
  estado.sugerencias = []
})

it('mientras busca muestra un esqueleto y no "Sin coincidencias"', async () => {
  render(<EntradaMensaje {...propiedades} />)
  await userEvent.setup().type(screen.getByRole('textbox'), '@ana')

  expect(await screen.findByRole('status', { name: 'Buscando' })).toBeVisible()
  expect(screen.queryByText('Sin coincidencias.')).not.toBeInTheDocument()
})

it('al llegar los resultados reemplaza el esqueleto por la lista', async () => {
  estado.buscando = false
  estado.sugerencias = [{ clave: 'ALUMNO:1', tipo: 'ALUMNO', id: '1', nombre: 'Ana Roca' }]
  render(<EntradaMensaje {...propiedades} />)
  await userEvent.setup().type(screen.getByRole('textbox'), '@ana')

  expect(await screen.findByText('Ana Roca')).toBeVisible()
  expect(screen.queryByRole('status', { name: 'Buscando' })).not.toBeInTheDocument()
})

it('si no hubo resultados avisa que no hay coincidencias', async () => {
  estado.buscando = false
  render(<EntradaMensaje {...propiedades} />)
  await userEvent.setup().type(screen.getByRole('textbox'), '@zzz')

  expect(await screen.findByText('Sin coincidencias.')).toBeVisible()
})

it('al elegir una opción queda como chip y el @ se borra del campo', async () => {
  estado.buscando = false
  estado.sugerencias = [{ clave: 'ALUMNO:1', tipo: 'ALUMNO', id: '1', nombre: 'Ana Roca' }]
  const onFijar = vi.fn()
  render(<EntradaMensaje {...propiedades} onFijar={onFijar} />)
  const campo = screen.getByRole('textbox')
  const usuario = userEvent.setup()

  await usuario.type(campo, '¿cómo viene @ana')
  await usuario.click(await screen.findByText('Ana Roca'))

  expect(onFijar).toHaveBeenCalledWith(estado.sugerencias[0])
  expect(campo).toHaveValue('¿cómo viene ')
  expect(screen.queryByRole('status', { name: 'Buscando' })).not.toBeInTheDocument()
})

it('lo que sigue a la mención se conserva y no quedan dos espacios juntos', async () => {
  estado.buscando = false
  estado.sugerencias = [{ clave: 'ALUMNO:1', tipo: 'ALUMNO', id: '1', nombre: 'Ana Roca' }]
  render(<EntradaMensaje {...propiedades} onFijar={vi.fn()} />)
  const campo = screen.getByRole('textbox')
  const usuario = userEvent.setup()

  await usuario.type(campo, 'deuda de  hoy')
  await usuario.type(campo, '@ana', { initialSelectionStart: 9, initialSelectionEnd: 9 })
  await usuario.click(await screen.findByText('Ana Roca'))

  expect(campo).toHaveValue('deuda de hoy')
})

it('cada resultado lleva el ícono de su tipo al principio', async () => {
  estado.buscando = false
  estado.sugerencias = [
    { clave: 'ALUMNO:1', tipo: 'ALUMNO', id: '1', nombre: 'Ana Roca' },
    { clave: 'CURSO:3', tipo: 'CURSO', id: '3', nombre: '3°A de Primario' },
  ]
  render(<EntradaMensaje {...propiedades} />)
  await userEvent.setup().type(screen.getByRole('textbox'), '@')

  for (const nombre of ['Ana Roca', '3°A de Primario']) {
    const fila = (await screen.findByText(nombre)).closest('[cmdk-item]')
    expect(fila?.firstElementChild?.tagName.toLowerCase()).toBe('svg')
  }
})
