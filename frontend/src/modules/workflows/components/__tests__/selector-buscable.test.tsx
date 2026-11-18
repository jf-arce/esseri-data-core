import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SelectorBuscable } from '@/modules/workflows/components/selector-buscable'
import { buscarOpcionesCampo } from '@/modules/workflows/services/buscar-opciones-campo'

vi.mock('@/modules/workflows/services/buscar-opciones-campo')

beforeEach(() => {
  vi.mocked(buscarOpcionesCampo).mockResolvedValue([
    { valor: 'Pérez, Lucía', etiqueta: 'Pérez, Lucía' },
    { valor: 'Gómez, Tomás', etiqueta: 'Gómez, Tomás' },
  ])
})

describe('SelectorBuscable', () => {
  it('busca en el servidor y guarda el texto exacto de la opción elegida', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SelectorBuscable
        campoId="c-1"
        valor=""
        disabled={false}
        permiteOtro={false}
        onChange={onChange}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: 'Valor' }))
    await user.type(screen.getByPlaceholderText('Buscar'), 'gom')
    await waitFor(() =>
      expect(buscarOpcionesCampo).toHaveBeenLastCalledWith('c-1', 'gom', expect.anything()),
    )
    await user.click(await screen.findByText('Gómez, Tomás'))

    expect(onChange).toHaveBeenCalledWith('Gómez, Tomás')
  })

  it('con "otro" permite escribir a mano y volver a la lista', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SelectorBuscable campoId="c-2" valor="" disabled={false} permiteOtro onChange={onChange} />,
    )

    await user.click(screen.getByRole('combobox', { name: 'Valor' }))
    await user.click(await screen.findByText('Otro (escribir a mano)'))

    await user.type(screen.getByRole('textbox', { name: 'Valor' }), 'x')
    expect(onChange).toHaveBeenCalledWith('x')

    await user.click(screen.getByRole('button', { name: 'Elegir de la lista' }))
    expect(screen.getByRole('combobox', { name: 'Valor' })).toBeInTheDocument()
  })

  it('sin la opción "otro" no la ofrece', async () => {
    const user = userEvent.setup()
    render(
      <SelectorBuscable
        campoId="c-1"
        valor=""
        disabled={false}
        permiteOtro={false}
        onChange={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: 'Valor' }))

    await screen.findByText('Pérez, Lucía')
    expect(screen.queryByText('Otro (escribir a mano)')).not.toBeInTheDocument()
  })
})
