import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MateriaCursoDialog } from '@/modules/academico/components/materia-curso-dialog'
import type { Materia } from '@/modules/academico/types'

const catalogo: Materia[] = [
  {
    id: 'm1',
    nombre: 'Lengua',
    tipo: 'materia',
    color: '#2563eb',
    cantidad_cursos: 0,
    created_at: '',
    updated_at: '',
  },
]

function abrir(props: Partial<Parameters<typeof MateriaCursoDialog>[0]> = {}) {
  return render(
    <MateriaCursoDialog
      open
      onOpenChange={vi.fn()}
      modo="crear"
      divisionId="d1"
      divisionNombre="1°A"
      catalogo={catalogo}
      onExito={vi.fn()}
      {...props}
    />,
  )
}

describe('MateriaCursoDialog', () => {
  it('permite eliminar una franja aunque sea la única', () => {
    abrir()
    expect(screen.getByRole('button', { name: 'Eliminar franja 1' })).toBeInTheDocument()
  })

  it('agrega franjas con el botón de abajo y elimina la elegida', async () => {
    const usuario = userEvent.setup()
    abrir()

    await usuario.click(screen.getByRole('button', { name: 'Agregar franja' }))
    expect(screen.getByRole('button', { name: 'Eliminar franja 2' })).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Eliminar franja 2' }))
    expect(screen.queryByRole('button', { name: 'Eliminar franja 2' })).not.toBeInTheDocument()
  })

  it('avisa el horario superpuesto con otra materia de la división', () => {
    abrir({
      horariosOcupados: [
        { materia: 'Matemática', dia_semana: 1, hora_inicio: '08:00', hora_fin: '09:00' },
      ],
      franjaInicial: { dia_semana: 1, hora_inicio: '08:30', hora_fin: '09:30' },
    })
    expect(screen.getByText('Horario superpuesto')).toBeInTheDocument()
  })
})
