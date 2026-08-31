import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FamiliaForm } from '../familia-form'

describe('FamiliaForm', () => {
  it('renders the form title', () => {
    render(<FamiliaForm onSubmit={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('Dar de alta familia')).toBeInTheDocument()
  })

  it('starts without hardcoded errors', () => {
    render(<FamiliaForm onSubmit={() => {}} onCancel={() => {}} />)
    expect(screen.queryByText('El teléfono es obligatorio')).not.toBeInTheDocument()
  })

  it('shows validation errors for empty fields', async () => {
    render(<FamiliaForm onSubmit={() => {}} onCancel={() => {}} />)
    const continueButton = screen.getByText('Continuar a datos de acceso')
    fireEvent.click(continueButton)
    expect(screen.getAllByText('El nombre es obligatorio')).toHaveLength(2)
    expect(screen.getAllByText('El apellido es obligatorio')).toHaveLength(2)
    expect(screen.getAllByText('El DNI es obligatorio')).toHaveLength(2)
    expect(screen.queryByText('El correo es obligatorio')).not.toBeInTheDocument()
  })

  it('submits the backend payload after validation', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<FamiliaForm onSubmit={onSubmit} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'García' } })
    fireEvent.change(screen.getByLabelText('DNI'), { target: { value: '40111222' } })
    fireEvent.click(screen.getByText('Continuar a datos de acceso'))
    fireEvent.change(screen.getByLabelText('Correo de acceso'), {
      target: { value: 'familia@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña provisoria'), {
      target: { value: 'una-contrasena-larga' },
    })
    fireEvent.click(screen.getByText('Continuar a vincular alumnos'))
    fireEvent.click(screen.getByText('Crear familia'))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'Ana', email: 'familia@example.com' }),
    )
  })
})
