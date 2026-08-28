import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FormularioInscripcion } from '@/modules/inscripciones/components/formulario-inscripcion'
import { listarAlumnosReinscripcion } from '@/modules/inscripciones/services/listar-alumnos-reinscripcion'
import { listarDivisionesDisponibles } from '@/modules/inscripciones/services/listar-divisiones-disponibles'
import { listarSolicitudesDisponibles } from '@/modules/inscripciones/services/listar-solicitudes-disponibles'

vi.mock('@/modules/inscripciones/services/listar-solicitudes-disponibles')
vi.mock('@/modules/inscripciones/services/listar-divisiones-disponibles')
vi.mock('@/modules/inscripciones/services/listar-alumnos-reinscripcion')
vi.mock('@/modules/inscripciones/services/crear-inscripcion')
vi.mock('@/modules/inscripciones/services/crear-reinscripcion')

describe('FormularioInscripcion', () => {
  beforeEach(() => {
    vi.mocked(listarSolicitudesDisponibles).mockResolvedValue([])
    vi.mocked(listarDivisionesDisponibles).mockResolvedValue([])
    vi.mocked(listarAlumnosReinscripcion).mockResolvedValue([])
  })

  it('muestra los campos propios de una reinscripción al cambiar el tipo', async () => {
    const user = userEvent.setup()
    render(<FormularioInscripcion onCancelar={vi.fn()} />)

    await user.click(screen.getByRole('radio', { name: 'Reinscripción' }))

    expect(screen.getByLabelText('Ciclo lectivo')).toBeEnabled()
    expect(screen.getByRole('combobox', { name: 'Alumno' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Solicitud confirmada' })).not.toBeInTheDocument()
  })

  it('presenta un resumen y errores inline cuando faltan datos obligatorios', async () => {
    const user = userEvent.setup()
    render(<FormularioInscripcion onCancelar={vi.fn()} />)

    await waitFor(() => expect(listarDivisionesDisponibles).toHaveBeenCalled())
    await user.click(screen.getByRole('button', { name: 'Registrar inscripción' }))

    expect(await screen.findByText('Hay 2 campos que revisar antes de guardar')).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: 'Solicitud confirmada: Seleccioná una solicitud confirmada.',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'División: Este campo es obligatorio.' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Seleccioná una solicitud confirmada.')).toBeInTheDocument()
    expect(screen.getByText('Este campo es obligatorio.')).toBeInTheDocument()
  })
})
