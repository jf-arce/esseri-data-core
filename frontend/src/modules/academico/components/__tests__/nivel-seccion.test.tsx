import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
      divisiones: [
        {
          id: 'd1',
          nombre: '1°A',
          anio_id: 'a1',
          cantidad_materias: 2,
          cantidad_inscripciones: 12,
          cantidad_asignaciones: 2,
          created_at: '',
          updated_at: '',
          materias: [
            {
              id: 'mc1',
              materia_id: 'm1',
              materia_nombre: 'Matemática',
              materia_tipo: 'materia',
              division_id: 'd1',
              division_nombre: '1°A',
              anio_id: 'a1',
              anio_numero: 1,
              nivel_educativo_id: 'n1',
              nivel_educativo_nombre: 'Primario',
              horarios: [
                {
                  id: 'h1',
                  dia_semana: 1,
                  hora_inicio: '08:00:00',
                  hora_fin: '09:00:00',
                },
              ],
              cantidad_asignaciones: 1,
              docentes: ['Pérez, Ana'],
              created_at: '',
              updated_at: '',
            },
            {
              id: 'mc2',
              materia_id: 'm2',
              materia_nombre: 'Educación Física',
              materia_tipo: 'materia',
              division_id: 'd1',
              division_nombre: '1°A',
              anio_id: 'a1',
              anio_numero: 1,
              nivel_educativo_id: 'n1',
              nivel_educativo_nombre: 'Primario',
              horarios: [],
              cantidad_asignaciones: 0,
              docentes: [],
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
  onAgregarMateriaCurso: vi.fn(),
  onEditarMateriaCurso: vi.fn(),
  onEliminarMateriaCurso: vi.fn(),
}

function abrirDetalleCurso() {
  return userEvent.click(screen.getByRole('button', { name: 'Ver detalle del curso 1°A' }))
}

describe('NivelSeccion', () => {
  it('sin `puedeEditar`, no muestra ningún trigger de escritura (dirección: mira, no opera)', async () => {
    render(<NivelSeccion nivel={nivel} puedeEditar={false} {...handlers} />)

    expect(screen.queryByLabelText('Acciones del nivel')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'División' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Acciones del año')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Acciones de la división')).not.toBeInTheDocument()
    // Los datos siguen visibles: solo se ocultan los triggers de escritura, no el contenido.
    expect(screen.getByText('Primario')).toBeInTheDocument()
    expect(screen.getByText('1°A')).toBeInTheDocument()

    await abrirDetalleCurso()

    expect(screen.getByText('Matemática')).toBeInTheDocument()
    expect(screen.getByText('Educación Física')).toBeInTheDocument()
    expect(screen.queryByLabelText('Editar materia')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Eliminar materia')).not.toBeInTheDocument()
  })

  it('con `puedeEditar`, muestra los triggers de escritura', async () => {
    render(<NivelSeccion nivel={nivel} puedeEditar {...handlers} />)

    expect(screen.getByLabelText('Acciones del nivel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'División' })).toBeInTheDocument()
    expect(screen.getByLabelText('Acciones del año')).toBeInTheDocument()
    expect(screen.getByLabelText('Acciones de la división')).toBeInTheDocument()

    // Las materias ya no se listan en la tarjeta: sus acciones viven en el detalle del curso.
    expect(screen.queryByLabelText('Editar materia')).not.toBeInTheDocument()

    await abrirDetalleCurso()

    // Dos materias-curso en la división: dos filas editables dentro del diálogo.
    expect(screen.getAllByLabelText('Editar materia')).toHaveLength(2)
    expect(screen.getAllByLabelText('Eliminar materia')).toHaveLength(2)
  })

  it('muestra horario y docentes al abrir el detalle del curso', async () => {
    render(<NivelSeccion nivel={nivel} puedeEditar={false} {...handlers} />)

    expect(screen.queryByText(/Lun 08:00–09:00/)).not.toBeInTheDocument()

    await abrirDetalleCurso()

    expect(screen.getByText(/Lun 08:00–09:00/)).toBeInTheDocument()
    expect(screen.getByText(/Sin horario/)).toBeInTheDocument()
    expect(screen.getByText('Pérez, Ana')).toBeInTheDocument()
    expect(screen.getByText(/sin docente/i)).toBeInTheDocument()
  })
})
