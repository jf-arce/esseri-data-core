import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NivelSeccion } from '@/modules/academico/components/nivel-seccion'
import type { NivelConEstructura } from '@/modules/academico/hooks/use-estructura-academica'

const nivel: NivelConEstructura = {
  id: 'n1',
  nombre: 'Primario',
  cantidad_anios: 1,
  created_at: '',
  updated_at: '',
  anios: [
    {
      id: 'a1',
      numero: 1,
      nivel_educativo_id: 'n1',
      cantidad_divisiones: 1,
      cantidad_materias: 2,
      created_at: '',
      updated_at: '',
      materias: [
        {
          id: 'm2',
          nombre: 'Educación Física',
          tipo: 'materia',
          anio_id: 'a1',
          division_id: null,
          cantidad_asignaciones: 1,
          created_at: '',
          updated_at: '',
        },
      ],
      divisiones: [
        {
          id: 'd1',
          nombre: '1°A',
          anio_id: 'a1',
          cantidad_materias: 1,
          cantidad_inscripciones: 12,
          cantidad_asignaciones: 1,
          created_at: '',
          updated_at: '',
          materias: [
            {
              id: 'm1',
              nombre: 'Matemática',
              tipo: 'materia',
              anio_id: 'a1',
              division_id: 'd1',
              cantidad_asignaciones: 1,
              created_at: '',
              updated_at: '',
            },
          ],
        },
      ],
    },
  ],
}

const handlers = {
  onEditarNivel: vi.fn(),
  onEliminarNivel: vi.fn(),
  onAgregarAnio: vi.fn(),
  onEditarAnio: vi.fn(),
  onEliminarAnio: vi.fn(),
  onAgregarDivision: vi.fn(),
  onEditarDivision: vi.fn(),
  onEliminarDivision: vi.fn(),
  onAgregarMateria: vi.fn(),
  onEditarMateria: vi.fn(),
  onEliminarMateria: vi.fn(),
}

describe('NivelSeccion', () => {
  it('sin `puedeEditar`, no muestra ningún trigger de escritura (dirección: mira, no opera)', () => {
    render(<NivelSeccion nivel={nivel} puedeEditar={false} {...handlers} />)

    expect(screen.queryByLabelText('Acciones del nivel')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'División' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Materia' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Acciones del año')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Acciones de la división')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Editar materia')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Eliminar materia')).not.toBeInTheDocument()
    // Los datos siguen visibles: solo se ocultan los triggers de escritura, no el contenido.
    expect(screen.getByText('Primario')).toBeInTheDocument()
    expect(screen.getByText('1°A')).toBeInTheDocument()
    expect(screen.getByText('Matemática')).toBeInTheDocument()
    expect(screen.getByText('Educación Física')).toBeInTheDocument()
  })

  it('con `puedeEditar`, muestra los triggers de escritura', () => {
    render(<NivelSeccion nivel={nivel} puedeEditar {...handlers} />)

    expect(screen.getByLabelText('Acciones del nivel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'División' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Materia' })).toBeInTheDocument()
    expect(screen.getByLabelText('Acciones del año')).toBeInTheDocument()
    expect(screen.getByLabelText('Acciones de la división')).toBeInTheDocument()
    // Una materia común al año y una propia de la división: dos filas editables.
    expect(screen.getAllByLabelText('Editar materia')).toHaveLength(2)
    expect(screen.getAllByLabelText('Eliminar materia')).toHaveLength(2)
  })
})
