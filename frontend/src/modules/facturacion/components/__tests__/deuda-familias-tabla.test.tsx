import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { DeudaFamiliasTabla } from '@/modules/facturacion/components/deuda-familias-tabla'
import type { DeudaFamilia } from '@/modules/facturacion/types'

const deuda: DeudaFamilia = {
  familia_id: 'familia-1',
  familia_nombre: 'Ana',
  familia_apellido: 'García',
  familia_dni: '30111222',
  monto_pendiente: '50000.00',
  monto_vencido: '60000.00',
  monto_pagado: '40000.00',
  deuda_total: '110000.00',
  facturas_pendientes: 2,
  facturas_pagadas: 1,
  estado: 'vencida',
}

describe('DeudaFamiliasTabla', () => {
  it('muestra el resumen de deuda y enlaza a la familia', () => {
    render(
      <MemoryRouter>
        <DeudaFamiliasTabla
          items={[deuda]}
          cargando={false}
          pagina={1}
          tamanioPagina={10}
          total={1}
          onCambiarPagina={vi.fn()}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'García, Ana' })).toHaveAttribute(
      'href',
      '/familias-alumnos/familias/familia-1',
    )
    expect(screen.getByText('2 pendientes · 1 pagadas')).toBeInTheDocument()
    expect(screen.getByText('Vencida')).toBeInTheDocument()
    expect(screen.getByText('1-1 de 1 responsables')).toBeInTheDocument()
  })

  it('solicita la página siguiente desde la paginación', async () => {
    const onCambiarPagina = vi.fn()
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <DeudaFamiliasTabla
          items={[deuda]}
          cargando={false}
          pagina={1}
          tamanioPagina={10}
          total={21}
          onCambiarPagina={onCambiarPagina}
        />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('link', { name: 'Ir a la página siguiente' }))

    expect(onCambiarPagina).toHaveBeenCalledWith(2)
  })
})
