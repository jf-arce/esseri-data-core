import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { catalogoAccion } from '@/modules/workflows/__tests__/fabricas'
import { CatalogoBloques } from '@/modules/workflows/components/catalogo-bloques'

const tiposAccion = [
  catalogoAccion('notificar'),
  catalogoAccion('alerta_interna'),
  catalogoAccion('aplicar_penalidad', { eventos_permitidos: ['factura.vencida'] }),
]

function abrir(props: Partial<Parameters<typeof CatalogoBloques>[0]> = {}) {
  const onElegir = vi.fn()
  render(
    <CatalogoBloques
      tiposAccion={tiposAccion}
      nombreEvento="factura.vencida"
      soloLectura={false}
      onElegir={onElegir}
      {...props}
    />,
  )
  return onElegir
}

describe('CatalogoBloques', () => {
  it('elige un bloque con un clic', async () => {
    const onElegir = abrir()

    await userEvent.setup().click(screen.getByRole('option', { name: /Alerta interna/ }))

    expect(onElegir).toHaveBeenCalledWith('alerta_interna')
  })

  it('el buscador deja solo los bloques que coinciden y avisa si no hay ninguno', async () => {
    const user = userEvent.setup()
    abrir()

    await user.type(screen.getByPlaceholderText('Buscar un bloque'), 'penal')
    expect(screen.getByRole('option', { name: /Aplicar penalidad/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Alerta interna/ })).not.toBeInTheDocument()

    await user.clear(screen.getByPlaceholderText('Buscar un bloque'))
    await user.type(screen.getByPlaceholderText('Buscar un bloque'), 'zzz')
    expect(screen.getByText('No hay bloques con ese nombre.')).toBeInTheDocument()
  })

  it('un bloque no permitido para el evento queda deshabilitado y dice por qué', async () => {
    const onElegir = abrir({ nombreEvento: 'factura.emitida' })

    const penalidad = screen.getByRole('option', { name: /Aplicar penalidad/ })
    expect(penalidad).toHaveAttribute('aria-disabled', 'true')
    expect(penalidad).toHaveTextContent(/evento/i)
    await userEvent.setup().click(penalidad)

    expect(onElegir).not.toHaveBeenCalled()
  })

  it('en solo lectura no se puede elegir nada', () => {
    abrir({ soloLectura: true })

    expect(screen.getByRole('option', { name: /Condición/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
})
