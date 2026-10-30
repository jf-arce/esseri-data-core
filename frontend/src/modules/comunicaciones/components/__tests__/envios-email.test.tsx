import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { EnviosEmail } from '../envios-email'
import { listarEnvios, reintentarEnvio } from '../../services/listar-envios'
import { estadoEnvio } from '../../utils'

vi.mock('../../services/listar-envios', () => ({
  listarEnvios: vi.fn(),
  reintentarEnvio: vi.fn(),
}))

beforeEach(() => vi.clearAllMocks())

it('labels provider submission and missing email without claiming delivery', () => {
  expect(estadoEnvio('presentado').etiqueta).toBe('Presentado al proveedor')
  expect(estadoEnvio('sin_email').etiqueta).toBe('Sin email')
  expect(estadoEnvio('procesando').etiqueta).toBe('En proceso')
})

it('shows every authorized attempt and only offers retry for definite failure', async () => {
  vi.mocked(listarEnvios).mockResolvedValue([
    {
      id: 'failed',
      email: 'test@example.test',
      estado: 'fallido',
      intentos: [
        {
          id: 'a',
          estado: 'fallido',
          error_codigo: 'conexion_rechazada',
          started_at: null,
          finished_at: null,
        },
        {
          id: 'b',
          estado: 'fallido',
          error_codigo: 'configuracion',
          started_at: null,
          finished_at: null,
        },
      ],
    },
    { id: 'unknown', email: 'other@example.test', estado: 'incierto', intentos: [] },
  ])
  vi.mocked(reintentarEnvio).mockResolvedValue({
    id: 'failed',
    email: 'test@example.test',
    estado: 'pendiente',
    intentos: [],
  })
  render(<EnviosEmail comunicacionId="communication" />)
  await screen.findByText('test@example.test')
  await userEvent.click(screen.getByText('Ver intentos'))
  expect(screen.getByText(/conexion_rechazada/)).toBeVisible()
  const retry = screen.getAllByRole('button', { name: 'Reintentar envío' })
  expect(retry).toHaveLength(1)
  await userEvent.click(retry[0])
  expect(reintentarEnvio).toHaveBeenCalledWith('communication', 'failed', false)
})
