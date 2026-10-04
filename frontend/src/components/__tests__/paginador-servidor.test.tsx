import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PaginadorServidor } from '@/components/paginador-servidor'

function renderizar(props: Partial<Parameters<typeof PaginadorServidor>[0]> = {}) {
  const onCambiarPagina = vi.fn()
  render(
    <PaginadorServidor
      pagina={2}
      tamanioPagina={10}
      total={35}
      totalPaginas={4}
      onCambiarPagina={onCambiarPagina}
      etiqueta="ejecuciones"
      {...props}
    />,
  )
  return onCambiarPagina
}

describe('PaginadorServidor', () => {
  it('muestra el rango y la etiqueta', () => {
    renderizar()

    expect(screen.getByText('11-20 de 35 ejecuciones')).toBeInTheDocument()
  })

  it('no renderiza nada sin resultados', () => {
    renderizar({ total: 0, totalPaginas: 1 })

    expect(screen.queryByText(/ejecuciones/)).not.toBeInTheDocument()
  })

  it('oculta los links con una sola página', () => {
    renderizar({ pagina: 1, total: 5, totalPaginas: 1 })

    expect(screen.getByText('1-5 de 5 ejecuciones')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('navega con clic a la página elegida', async () => {
    const onCambiarPagina = renderizar()

    await userEvent.click(screen.getByRole('link', { name: '3' }))
    await userEvent.click(screen.getByRole('link', { name: 'Ir a la página anterior' }))
    await userEvent.click(screen.getByRole('link', { name: 'Ir a la página siguiente' }))

    expect(onCambiarPagina.mock.calls).toEqual([[3], [1], [3]])
  })

  it('se activa con Enter desde el teclado', async () => {
    const onCambiarPagina = renderizar()

    screen.getByRole('link', { name: '4' }).focus()
    await userEvent.keyboard('{Enter}')

    expect(onCambiarPagina).toHaveBeenCalledWith(4)
  })

  it('deshabilita anterior en la primera página', () => {
    renderizar({ pagina: 1 })
    expect(screen.getByRole('link', { name: 'Ir a la página anterior' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('deshabilita siguiente en la última página', () => {
    renderizar({ pagina: 4 })
    expect(screen.getByRole('link', { name: 'Ir a la página siguiente' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('no navega fuera de rango', async () => {
    const onCambiarPagina = renderizar({ pagina: 1 })

    await userEvent.click(screen.getByRole('link', { name: 'Ir a la página anterior' }))

    expect(onCambiarPagina).not.toHaveBeenCalled()
  })
})
