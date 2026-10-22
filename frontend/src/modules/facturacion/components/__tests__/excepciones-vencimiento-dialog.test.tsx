import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ExcepcionesVencimientoDialog } from '@/modules/facturacion/components/excepciones-vencimiento-dialog'
import { anularExcepcionVencimiento } from '@/modules/facturacion/services/anular-excepcion-vencimiento'
import { crearExcepcionVencimiento } from '@/modules/facturacion/services/crear-excepcion-vencimiento'
import { listarExcepcionesVencimiento } from '@/modules/facturacion/services/listar-excepciones-vencimiento'
import type { ExcepcionVencimiento } from '@/modules/facturacion/types'

vi.mock('@/modules/facturacion/services/listar-excepciones-vencimiento', () => ({
  listarExcepcionesVencimiento: vi.fn(),
}))
vi.mock('@/modules/facturacion/services/crear-excepcion-vencimiento', () => ({
  crearExcepcionVencimiento: vi.fn(),
}))
vi.mock('@/modules/facturacion/services/anular-excepcion-vencimiento', () => ({
  anularExcepcionVencimiento: vi.fn(),
}))

const vigente: ExcepcionVencimiento = {
  id: 'vigente',
  familia_id: 'familia-1',
  fecha_vencimiento_excepcional: '2027-03-20',
  motivo: 'Acuerdo con Dirección',
  created_at: '2027-03-01T12:00:00Z',
  usuario_id: 'usuario-1',
  anulada_at: null,
  usuario_anulacion_id: null,
}
const anulada: ExcepcionVencimiento = {
  ...vigente,
  id: 'anulada',
  fecha_vencimiento_excepcional: '2027-02-15',
  anulada_at: '2027-02-10T12:00:00Z',
  usuario_anulacion_id: 'usuario-1',
}

function renderizar(permisos = { puedeOtorgar: true, puedeAnular: true }) {
  render(
    <ExcepcionesVencimientoDialog
      familiaId="familia-1"
      familiaNombre="García, Ana"
      onOpenChange={vi.fn()}
      {...permisos}
    />,
  )
}

describe('ExcepcionesVencimientoDialog', () => {
  beforeEach(() => {
    vi.mocked(listarExcepcionesVencimiento).mockResolvedValue([vigente, anulada])
    vi.mocked(anularExcepcionVencimiento).mockResolvedValue({
      ...vigente,
      anulada_at: '2027-03-02T12:00:00Z',
    })
    vi.mocked(crearExcepcionVencimiento).mockReset()
  })

  it('solo ofrece anular las vigentes y pide confirmación', async () => {
    const user = userEvent.setup()
    renderizar()

    expect(await screen.findByText('Anulada')).toBeInTheDocument()
    const botones = screen.getAllByRole('button', { name: 'Anular' })
    expect(botones).toHaveLength(1)

    await user.click(botones[0])
    expect(anularExcepcionVencimiento).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Confirmar anulación' }))

    expect(anularExcepcionVencimiento).toHaveBeenCalledWith('vigente')
  })

  it('exige fecha y motivo antes de otorgar', async () => {
    const user = userEvent.setup()
    renderizar()

    await user.click(await screen.findByRole('button', { name: 'Otorgar' }))

    expect(screen.getByRole('alert')).toHaveTextContent('fecha de vencimiento y el motivo')
    expect(crearExcepcionVencimiento).not.toHaveBeenCalled()
  })

  it('sin permisos muestra el historial sin acciones', async () => {
    renderizar({ puedeOtorgar: false, puedeAnular: false })

    expect(await screen.findByText('Vigente')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Anular' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Otorgar' })).not.toBeInTheDocument()
  })
})
