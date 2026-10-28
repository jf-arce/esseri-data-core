import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RedactarComunicacionDialog } from '@/modules/ia-sugerencias/components/redactar-comunicacion-dialog'
import { pedirBorradorComunicacion } from '@/modules/ia-sugerencias/services/pedir-borrador-comunicacion'
import { listarTiposEvento } from '@/modules/workflows/services/listar-tipos-evento'

vi.mock('@/modules/ia-sugerencias/services/pedir-borrador-comunicacion', () => ({
  pedirBorradorComunicacion: vi.fn(),
}))
vi.mock('@/modules/workflows/services/listar-tipos-evento', () => ({
  listarTiposEvento: vi.fn(),
}))

describe('RedactarComunicacionDialog', () => {
  beforeEach(() => {
    vi.mocked(listarTiposEvento).mockResolvedValue([
      { id: 'e1', nombre: 'factura.vencida', descripcion: null, campos: [] },
    ])
    vi.mocked(pedirBorradorComunicacion).mockReset()
  })

  it('no le pide nada a la IA si falta el evento', async () => {
    const user = userEvent.setup()
    render(<RedactarComunicacionDialog onOpenChange={vi.fn()} onCreada={vi.fn()} />)

    await user.type(screen.getByLabelText('Nombre de la plantilla'), 'Aviso de cuota')
    await user.type(
      screen.getByLabelText('Qué tiene que decir'),
      'Recordar con tono amable que la cuota venció.',
    )
    await user.click(screen.getByRole('button', { name: 'Redactar borrador' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Elegí el evento')
    expect(pedirBorradorComunicacion).not.toHaveBeenCalled()
  })
})
