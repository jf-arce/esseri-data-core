import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ChipsContexto } from '../components/chips-contexto'

it('muestra la pantalla y cada cosa fijada con su tipo', () => {
  render(
    <ChipsContexto
      pantalla={{ tipo: 'pantalla', texto: 'Académico' }}
      onQuitarPantalla={vi.fn()}
      fijados={[
        { tipo: 'ALUMNO', entidad_id: 'a1', nombre: 'Ana Pérez' },
        { tipo: 'CURSO', entidad_id: 'c1', nombre: '3°A de Primario' },
      ]}
      maximo={10}
      onQuitarFijado={vi.fn()}
    />,
  )
  const chips = screen.getAllByRole('listitem')
  // El tipo es un ícono: el nombre del tipo queda para lectores de pantalla y tooltip.
  expect(chips.map((chip) => chip.getAttribute('title'))).toEqual([
    'Pantalla: Académico',
    'Alumno: Ana Pérez',
    'Curso: 3°A de Primario',
  ])
  expect(screen.getByText('Ana Pérez')).toBeVisible()
  expect(screen.queryByText('Alumno: Ana Pérez')).not.toBeInTheDocument()
})

it('cada chip se puede sacar por separado', async () => {
  const onQuitarPantalla = vi.fn()
  const onQuitarFijado = vi.fn()
  render(
    <ChipsContexto
      pantalla={{ tipo: 'ficha', texto: 'Juan Pérez' }}
      onQuitarPantalla={onQuitarPantalla}
      fijados={[{ tipo: 'DOCENTE', entidad_id: 'd1', nombre: 'Marta Díaz' }]}
      maximo={10}
      onQuitarFijado={onQuitarFijado}
    />,
  )
  const usuario = userEvent.setup()

  await usuario.click(
    screen.getByRole('button', { name: 'Dejar de usar a Marta Díaz como contexto' }),
  )
  expect(onQuitarFijado).toHaveBeenCalledWith('DOCENTE', 'd1')
  expect(onQuitarPantalla).not.toHaveBeenCalled()

  await usuario.click(
    screen.getByRole('button', { name: 'Dejar de usar la pantalla como contexto' }),
  )
  expect(onQuitarPantalla).toHaveBeenCalledOnce()
})

it('sin nada que mostrar no dibuja nada', () => {
  const { container } = render(
    <ChipsContexto
      pantalla={null}
      onQuitarPantalla={vi.fn()}
      fijados={[]}
      maximo={10}
      onQuitarFijado={vi.fn()}
    />,
  )
  expect(container).toBeEmptyDOMElement()
})

it('avisa cuando se llegó al máximo y no antes', () => {
  const fijados = (cantidad: number) =>
    Array.from({ length: cantidad }, (_, i) => ({
      tipo: 'ALUMNO' as const,
      entidad_id: `a${i}`,
      nombre: `Alumno ${i}`,
    }))
  const { rerender } = render(
    <ChipsContexto
      pantalla={null}
      onQuitarPantalla={vi.fn()}
      fijados={fijados(2)}
      maximo={2}
      onQuitarFijado={vi.fn()}
    />,
  )
  expect(screen.getByRole('status')).toHaveTextContent('Llegaste al máximo de 2')

  rerender(
    <ChipsContexto
      pantalla={null}
      onQuitarPantalla={vi.fn()}
      fijados={fijados(1)}
      maximo={2}
      onQuitarFijado={vi.fn()}
    />,
  )
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
