import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MateriaDialog } from '@/modules/academico/components/materia-dialog'
import { actualizarMateria, crearMateria } from '@/modules/academico/services/materias'
import type { Materia } from '@/modules/academico/types'

vi.mock('@/modules/academico/services/materias')

const materia: Materia = {
  id: 'm1',
  nombre: 'Lengua',
  tipo: 'materia',
  color: '#1e90ff',
  cantidad_cursos: 0,
  created_at: '',
  updated_at: '',
}

beforeEach(() => vi.resetAllMocks())

function abrir(modo: 'crear' | 'editar', item?: Materia) {
  render(<MateriaDialog open onOpenChange={vi.fn()} modo={modo} item={item} onExito={vi.fn()} />)
}

describe('MateriaDialog', () => {
  it('al editar muestra el color guardado y lo envía al guardar', async () => {
    vi.mocked(actualizarMateria).mockResolvedValue(materia)
    abrir('editar', materia)

    expect(screen.getByRole('button', { name: 'Elegir color' })).toHaveTextContent('#1e90ff')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(actualizarMateria).toHaveBeenCalledWith('m1', {
      nombre: 'Lengua',
      tipo: 'materia',
      color: '#1e90ff',
    })
  })

  it('"Automático" borra el color y manda null', async () => {
    vi.mocked(actualizarMateria).mockResolvedValue(materia)
    abrir('editar', materia)

    await userEvent.click(screen.getByRole('button', { name: 'Elegir color' }))
    await userEvent.click(screen.getByRole('button', { name: 'Automático' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(actualizarMateria).toHaveBeenCalledWith('m1', {
      nombre: 'Lengua',
      tipo: 'materia',
      color: null,
    })
  })

  it('al crear sin elegir color manda null (automático)', async () => {
    vi.mocked(crearMateria).mockResolvedValue(materia)
    abrir('crear')

    expect(screen.getByRole('button', { name: 'Elegir color' })).toHaveTextContent('Automático')
    await userEvent.type(screen.getByLabelText('Nombre de la materia'), 'Arte')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(crearMateria).toHaveBeenCalledWith({ nombre: 'Arte', tipo: 'materia', color: null })
  })
})
