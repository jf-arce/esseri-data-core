import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LiberarLoteDialog } from '@/modules/facturacion/components/liberar-lote-dialog'
import type { LoteDebitoResumen } from '@/modules/facturacion/types'

const lote: LoteDebitoResumen = {
  id: 'lote-1',
  codigo: 'LD-2026-10-001',
  fecha_exportacion: '2026-10-05',
  periodo: '2026-10',
  cantidad_facturas: 12,
  importe_total: '2064000.00',
  estado: 'exportado',
  resultados_importados: false,
  importacion_id: null,
  liberacion: null,
}

describe('LiberarLoteDialog', () => {
  it('exige motivo y la confirmación de que el banco no procesó el lote', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(<LiberarLoteDialog open lote={lote} onOpenChange={vi.fn()} onConfirm={onConfirm} />)

    const liberar = screen.getByRole('button', { name: 'Liberar 12 facturas' })
    expect(liberar).toBeDisabled()

    await user.click(
      screen.getByRole('checkbox', { name: 'Confirmo que el banco no procesó este lote.' }),
    )
    expect(liberar).toBeDisabled()

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Motivo' }),
      'Archivo no enviado al banco',
    )
    await waitFor(() => expect(liberar).toBeEnabled())

    await user.click(liberar)
    expect(onConfirm).toHaveBeenCalledWith('Archivo no enviado al banco')
  })

  it('permite escribir el detalle cuando el motivo es Otro', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(<LiberarLoteDialog open lote={lote} onOpenChange={vi.fn()} onConfirm={onConfirm} />)

    await user.click(
      screen.getByRole('checkbox', { name: 'Confirmo que el banco no procesó este lote.' }),
    )
    await user.selectOptions(screen.getByRole('combobox', { name: 'Motivo' }), 'Otro')
    await user.type(screen.getByLabelText('Detalle del motivo'), 'Lote duplicado por error')

    await user.click(screen.getByRole('button', { name: 'Liberar 12 facturas' }))
    expect(onConfirm).toHaveBeenCalledWith('Lote duplicado por error')
  })

  it('no libera y muestra el error si la operación falla', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockRejectedValue(new Error('El lote ya tiene resultados.'))
    render(<LiberarLoteDialog open lote={lote} onOpenChange={vi.fn()} onConfirm={onConfirm} />)

    await user.click(
      screen.getByRole('checkbox', { name: 'Confirmo que el banco no procesó este lote.' }),
    )
    await user.selectOptions(screen.getByRole('combobox', { name: 'Motivo' }), 'Otro')
    await user.type(screen.getByLabelText('Detalle del motivo'), 'Lote duplicado')
    await user.click(screen.getByRole('button', { name: 'Liberar 12 facturas' }))

    expect(await screen.findByText('El lote ya tiene resultados.')).toBeInTheDocument()
  })
})
