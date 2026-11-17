import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ListaMensajes } from '../components/lista-mensajes'
import type { MensajeVisible } from '../types'

const propiedades = {
  mensajes: [],
  porAlias: {},
  alElegir: vi.fn(),
  alIr: () => null,
  alReintentar: null,
  sugerencias: ['¿Cómo viene la deuda por familia?'],
  alSugerir: vi.fn(),
}

function respuesta(id: string, contenido: string): MensajeVisible {
  return {
    id,
    autor: 'asistente',
    contenido,
    bloques: [],
    estado: 'completo',
    herramienta: null,
    pasos: [],
  }
}

function renderizar(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <TooltipProvider>{ui}</TooltipProvider>
    </MemoryRouter>,
  )
}

it('al hacer clic en una sugerencia la manda como pregunta', async () => {
  const alSugerir = vi.fn()
  renderizar(<ListaMensajes {...propiedades} alSugerir={alSugerir} />)

  await userEvent.click(screen.getByRole('button', { name: '¿Cómo viene la deuda por familia?' }))

  expect(alSugerir).toHaveBeenCalledWith('¿Cómo viene la deuda por familia?')
})

it('sin sugerencias no muestra botones', () => {
  renderizar(<ListaMensajes {...propiedades} sugerencias={[]} />)

  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('ofrece reintentar solo en el último mensaje', () => {
  renderizar(
    <ListaMensajes
      {...propiedades}
      mensajes={[respuesta('a', 'Primera'), respuesta('b', 'Segunda')]}
      alReintentar={vi.fn()}
    />,
  )

  expect(screen.getAllByRole('button', { name: 'Copiar respuesta' })).toHaveLength(2)
  expect(screen.getAllByRole('button', { name: 'Reintentar' })).toHaveLength(1)
})

it('copia el texto con los nombres reales en lugar de los alias', async () => {
  const usuario = userEvent.setup()
  renderizar(
    <ListaMensajes
      {...propiedades}
      mensajes={[respuesta('a', 'Deuda de [FAMILIA:1]')]}
      porAlias={{
        '[FAMILIA:1]': {
          alias: '[FAMILIA:1]',
          tipo: 'FAMILIA',
          entidad_id: 'f1',
          nombre: 'Pérez, Ana',
        },
      }}
    />,
  )

  await usuario.click(screen.getByRole('button', { name: 'Copiar respuesta' }))

  const copiado = await navigator.clipboard.readText()
  expect(copiado).toContain('Ana Pérez')
  expect(copiado).not.toContain('[FAMILIA:1]')
})

it('en la pregunta del usuario resalta el atajo y deja el texto aparte', () => {
  const pregunta: MensajeVisible = {
    ...respuesta('u', '/comparar asistencias de octubre'),
    autor: 'usuario',
  }
  renderizar(<ListaMensajes {...propiedades} mensajes={[pregunta]} />)

  expect(document.querySelector('[data-slot="atajo-resaltado"]')).toHaveTextContent('/comparar')
  expect(screen.getByText('asistencias de octubre')).toBeInTheDocument()
})

it('editar una pregunta la reenvía con el texto nuevo y su atajo', async () => {
  const alEditar = vi.fn()
  const pregunta: MensajeVisible = {
    ...respuesta('u-real', '/comparar asistencias de octubre'),
    autor: 'usuario',
  }
  renderizar(<ListaMensajes {...propiedades} mensajes={[pregunta]} alEditar={alEditar} />)

  await userEvent.click(screen.getByRole('button', { name: 'Editar pregunta' }))
  const campo = screen.getByRole('textbox', { name: 'Editar pregunta' })
  expect(campo).toHaveValue('asistencias de octubre')
  await userEvent.clear(campo)
  await userEvent.type(campo, 'asistencias de noviembre')
  await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))

  expect(alEditar).toHaveBeenCalledWith('u-real', 'asistencias de noviembre', [], 'comparar')
})

it('no ofrece editar mientras se genera ni con un id todavía local', () => {
  const local: MensajeVisible = { ...respuesta('local-1', 'hola'), autor: 'usuario' }
  const real: MensajeVisible = { ...respuesta('u2', 'hola'), autor: 'usuario' }
  const { rerender } = renderizar(
    <ListaMensajes {...propiedades} mensajes={[local]} alEditar={vi.fn()} />,
  )
  expect(screen.queryByRole('button', { name: 'Editar pregunta' })).not.toBeInTheDocument()
  rerender(
    <MemoryRouter>
      <TooltipProvider>
        <ListaMensajes {...propiedades} mensajes={[real]} alEditar={null} />
      </TooltipProvider>
    </MemoryRouter>,
  )
  expect(screen.queryByRole('button', { name: 'Editar pregunta' })).not.toBeInTheDocument()
})
