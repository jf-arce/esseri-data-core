import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MateriaCursoDialog } from '@/modules/academico/components/materia-curso-dialog'
import { actualizarMateria } from '@/modules/academico/services/materias'
import {
  actualizarMateriaCurso,
  crearMateriaCurso,
} from '@/modules/academico/services/materias-curso'
import { COLORES_SUGERIDOS } from '@/modules/academico/utils'
import type { Materia, MateriaCurso } from '@/modules/academico/types'

vi.mock('@/modules/academico/services/materias')
vi.mock('@/modules/academico/services/materias-curso')

beforeEach(() => vi.resetAllMocks())

const materiaCursoCreada: MateriaCurso = {
  id: 'mc1',
  materia_id: 'm2',
  materia_nombre: 'Arte',
  materia_tipo: 'materia',
  materia_color: '#2563eb',
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
  describe('eliminar', () => {
    it('avisa cuántos docentes se desasignan y deja confirmar', () => {
      abrir({ modo: 'eliminar', item: { ...materiaCursoCreada, cantidad_asignaciones: 2 } })

      expect(screen.getByText(/van a desasignar 2 docentes/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Eliminar materia' })).toBeEnabled()
    })

    it('no muestra el aviso si no hay docentes asignados', () => {
      abrir({ modo: 'eliminar', item: materiaCursoCreada })

      expect(screen.queryByText(/desasignar/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Eliminar materia' })).toBeEnabled()
    })
  })

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

  it('al crear una materia nueva pide nombre, tipo y color, y envía el color', async () => {
    vi.mocked(crearMateriaCurso).mockResolvedValue(materiaCursoCreada)
    const usuario = userEvent.setup()
    abrir()

    await usuario.click(screen.getByRole('combobox', { name: 'Materia' }))
    await usuario.click(screen.getByRole('option', { name: 'Crear nueva materia' }))

    expect(screen.getByLabelText('Nombre de la nueva materia')).toBeInTheDocument()
    const botonColor = screen.getByRole('button', { name: 'Elegir color' })
    const color = botonColor.textContent
    expect(COLORES_SUGERIDOS).toContain(color)

    await usuario.type(screen.getByLabelText('Nombre de la nueva materia'), 'Arte')
    await usuario.click(screen.getByRole('button', { name: 'Asignar materia' }))

    expect(crearMateriaCurso).toHaveBeenCalledWith(
      expect.objectContaining({
        materia_nombre: 'Arte',
        materia_tipo: 'materia',
        materia_color: color,
      }),
    )
  })

  describe('color al editar', () => {
    const item: MateriaCurso = {
      ...materiaCursoCreada,
      materia_id: 'm1',
      materia_nombre: 'Lengua',
      horarios: [{ id: 'h1', dia_semana: 1, hora_inicio: '08:00:00', hora_fin: '09:00:00' }],
    }

    it('cambia el color de la materia y guarda', async () => {
      vi.mocked(actualizarMateria).mockResolvedValue(catalogo[0])
      vi.mocked(actualizarMateriaCurso).mockResolvedValue(item)
      const usuario = userEvent.setup()
      abrir({ modo: 'editar', item })

      await usuario.click(screen.getByRole('button', { name: 'Elegir color' }))
      const campo = screen.getByRole('textbox', { name: 'Color en hexadecimal' })
      await usuario.tripleClick(campo)
      await usuario.paste('#16a34a')
      await usuario.click(screen.getByRole('button', { name: /guardar/i }))

      expect(actualizarMateria).toHaveBeenCalledWith('m1', { color: '#16a34a' })
      expect(actualizarMateriaCurso).toHaveBeenCalled()
    })

    it('no toca la materia si no se cambió el color', async () => {
      vi.mocked(actualizarMateriaCurso).mockResolvedValue(item)
      const usuario = userEvent.setup()
      abrir({ modo: 'editar', item })

      await usuario.click(screen.getByRole('button', { name: /guardar/i }))

      expect(actualizarMateria).not.toHaveBeenCalled()
    })
  })
})
