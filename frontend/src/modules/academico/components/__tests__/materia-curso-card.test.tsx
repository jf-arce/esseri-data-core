import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MateriaCursoCard } from '@/modules/academico/components/materia-curso-card'
import type { MateriaCurso } from '@/modules/academico/types'

const materiaCurso: MateriaCurso = {
  id: 'mc1',
  materia_id: 'm1',
  materia_nombre: 'Lengua',
  materia_tipo: 'materia',
  materia_color: null,
  division_id: 'd1',
  division_nombre: '1°A',
  anio_id: 'a1',
  anio_numero: 1,
  nivel_educativo_id: 'n1',
  nivel_educativo_nombre: 'Primario',
  horarios: [],
  cantidad_asignaciones: 0,
  created_at: '',
  updated_at: '',
}

function montar(color: string | null) {
  render(
    <MateriaCursoCard
      materiaCurso={{ ...materiaCurso, materia_color: color }}
      docentes={[]}
      puedeEditar={false}
      onEditar={vi.fn()}
      onQuitar={vi.fn()}
    />,
  )
  return screen.getByText('Lengua').closest('[data-slot="card"]')
}

describe('MateriaCursoCard', () => {
  it('pinta la franja con el color de la materia', () => {
    expect(montar('#1e90ff')).toHaveStyle({ borderLeftColor: '#1e90ff' })
  })

  it('sin color válido usa un gris neutro', () => {
    expect(montar(null)).toHaveStyle({ borderLeftColor: '#64748b' })
  })

  it('avisa cuando falta el horario', () => {
    montar(null)
    expect(screen.getByText('Sin horario')).toBeInTheDocument()
  })

  it('ofrece asignar docente solo a quien puede editar y si no tiene', async () => {
    const onAsignarDocente = vi.fn()
    const props = {
      materiaCurso,
      docentes: [],
      onEditar: vi.fn(),
      onQuitar: vi.fn(),
      onAsignarDocente,
    }
    const { rerender } = render(<MateriaCursoCard {...props} puedeEditar={false} />)
    expect(screen.queryByRole('button', { name: /asignar docente/i })).not.toBeInTheDocument()

    rerender(<MateriaCursoCard {...props} puedeEditar />)
    await userEvent.click(screen.getByRole('button', { name: 'Asignar docente a Lengua' }))
    expect(onAsignarDocente).toHaveBeenCalledWith(materiaCurso)

    rerender(<MateriaCursoCard {...props} docentes={['Pérez, Ana']} puedeEditar />)
    expect(screen.queryByRole('button', { name: /asignar docente/i })).not.toBeInTheDocument()
  })

  it('muestra con qué materias se superpone', () => {
    render(
      <MateriaCursoCard
        materiaCurso={materiaCurso}
        docentes={['Pérez, Ana']}
        conflictos={['Matemática', 'Arte']}
        puedeEditar={false}
        onEditar={vi.fn()}
        onQuitar={vi.fn()}
      />,
    )
    expect(screen.getByText('Se superpone con Matemática, Arte')).toBeInTheDocument()
  })

  it('el horario lleva a la vista de horario', async () => {
    const onVerHorario = vi.fn()
    const conHorario = {
      ...materiaCurso,
      horarios: [{ id: 'h1', dia_semana: 1, hora_inicio: '08:00', hora_fin: '09:00' }],
    }
    render(
      <MateriaCursoCard
        materiaCurso={conHorario}
        docentes={['Pérez, Ana']}
        puedeEditar={false}
        onEditar={vi.fn()}
        onQuitar={vi.fn()}
        onVerHorario={onVerHorario}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Lun 08:00 a 09:00/ }))
    expect(onVerHorario).toHaveBeenCalledWith(conHorario)
  })

  it('los botones de editar y eliminar nombran el tipo de la card', () => {
    const props = {
      docentes: ['Pérez, Ana'],
      puedeEditar: true,
      onEditar: vi.fn(),
      onQuitar: vi.fn(),
    }
    const { rerender } = render(<MateriaCursoCard materiaCurso={materiaCurso} {...props} />)
    expect(screen.getByRole('button', { name: 'Editar materia' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eliminar materia' })).toBeInTheDocument()

    rerender(
      <MateriaCursoCard materiaCurso={{ ...materiaCurso, materia_tipo: 'taller' }} {...props} />,
    )
    expect(screen.getByRole('button', { name: 'Editar taller' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eliminar taller' })).toBeInTheDocument()
  })
})
