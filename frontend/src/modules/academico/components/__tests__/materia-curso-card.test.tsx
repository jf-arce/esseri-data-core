import { render, screen } from '@testing-library/react'
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
  it('pinta la franja con el color elegido a mano', () => {
    expect(montar('#1e90ff')).toHaveStyle({ borderLeftColor: '#1e90ff' })
  })

  it('sin color elegido usa la franja de la paleta automática', () => {
    expect(montar(null)?.getAttribute('style')).toBeNull()
  })
})
