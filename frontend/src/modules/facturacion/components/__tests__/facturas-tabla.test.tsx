import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { FacturasTabla } from '@/modules/facturacion/components/facturas-tabla'
import type { Factura } from '@/modules/facturacion/types'

const factura: Factura = {
  id: 'factura-1',
  fecha_emision: '2026-08-01',
  fecha_vencimiento: '2026-08-10',
  monto_total: '120000.00',
  estado: 'pendiente',
  updated_at: '2026-08-01T00:00:00Z',
  inscripcion_id: 'inscripcion-1',
  responsable_economico_id: 'responsable-1',
  alumno_id: 'alumno-1',
  alumno_nombre: 'Ana',
  alumno_apellido: 'García',
  detalles: [
    {
      id: 'detalle-1',
      concepto_cobro_id: 'cuota',
      monto: '120000.00',
      descripcion: 'DEMO · Cuota educativa mensual · 08/2026',
    },
    {
      id: 'detalle-2',
      concepto_cobro_id: 'comedor',
      monto: '100.00',
      descripcion: 'Comedor agosto',
    },
  ],
}

describe('FacturasTabla', () => {
  it('compacta conceptos y conserva visible el estado con scroll horizontal de respaldo', () => {
    const { container } = render(
      <TooltipProvider>
        <MemoryRouter>
          <FacturasTabla
            items={[factura]}
            cargando={false}
            pagina={1}
            tamanioPagina={10}
            total={1}
            onCambiarPagina={vi.fn()}
            ordenarPor="fecha_vencimiento"
            direccion="asc"
            onOrdenar={vi.fn()}
          />
        </MemoryRouter>
      </TooltipProvider>,
    )

    expect(screen.getByText('Cuota educativa mensual + 1 más')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver 2 conceptos' })).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
    expect(container.querySelector('[data-slot="table-container"]')).toHaveClass('overflow-x-auto')
  })
})
