import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AsignacionDialog } from '@/modules/academico/components/asignacion-dialog'
import { crearAsignacionesBulk } from '@/modules/academico/services/asignaciones-docentes'
import type { Division, Docente, MateriaCurso } from '@/modules/academico/types'

vi.mock('@/modules/academico/services/asignaciones-docentes')
vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }))

const marca = { created_at: '', updated_at: '' }
const docente: Docente = {
  id: 'doc1',
  legajo: 'L1',
  persona_id: 'p1',
  nombre: 'Ana',
  apellido: 'Pérez',
  ...marca,
}
const division: Division = {
  id: 'd1',
  nombre: 'A',
  anio_id: 'a1',
  cantidad_inscripciones: 0,
  cantidad_materias: 0,
  cantidad_asignaciones: 0,
  ...marca,
}
const materiaCurso: MateriaCurso = {
  id: 'mc1',
  materia_id: 'm1',
  materia_nombre: 'Lengua',
  materia_tipo: 'materia',
  materia_color: null,
  division_id: 'd1',
  division_nombre: 'A',
  anio_id: 'a1',
  anio_numero: 1,
  nivel_educativo_id: 'n1',
  nivel_educativo_nombre: 'Primario',
  horarios: [],
  cantidad_asignaciones: 0,
  ...marca,
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(crearAsignacionesBulk).mockResolvedValue({ creadas: [], omitidas: [] })
})

describe('AsignacionDialog con la materia ya elegida', () => {
  it('no pide división ni materias y asigna solo esa materia', async () => {
    const onExito = vi.fn()
    render(
      <AsignacionDialog
        open
        onOpenChange={vi.fn()}
        modo="crear"
        docentes={[docente]}
        materiasCurso={[materiaCurso]}
        divisiones={[division]}
        cicloActual="2026"
        preseleccion={{ divisionId: 'd1', materiaCursoId: 'mc1' }}
        onExito={onExito}
      />,
    )

    expect(screen.queryByText('División')).not.toBeInTheDocument()
    expect(screen.queryByText('Materias')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('combobox', { name: 'Docente' }))
    await userEvent.click(await screen.findByRole('option', { name: /Ana Pérez/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Asignar materias' }))

    await waitFor(() =>
      expect(crearAsignacionesBulk).toHaveBeenCalledWith({
        ciclo_lectivo: '2026',
        docente_id: 'doc1',
        items: [{ materia_curso_id: 'mc1' }],
      }),
    )
    expect(onExito).toHaveBeenCalled()
  })
})
