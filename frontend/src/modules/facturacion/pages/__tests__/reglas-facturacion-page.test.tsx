import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ReglasFacturacionPage } from '@/modules/facturacion/pages/reglas-facturacion-page'
import { actualizarEstadoReglaFacturacion } from '@/modules/facturacion/services/actualizar-estado-regla-facturacion'
import { listarReglasFacturacion } from '@/modules/facturacion/services/listar-reglas-facturacion'
import type { ReglaFacturacion } from '@/modules/facturacion/types'

vi.mock('@/modules/facturacion/services/listar-reglas-facturacion')
vi.mock('@/modules/facturacion/services/actualizar-estado-regla-facturacion')
vi.mock('@/modules/facturacion/components/regla-facturacion-detalle-sheet', () => ({
  ReglaFacturacionDetalleSheet: ({ regla }: { regla: ReglaFacturacion | null }) =>
    regla ? <div role="dialog">Detalle de {regla.nombre}</div> : null,
}))

function crearRegla(sobrescribir: Partial<ReglaFacturacion>): ReglaFacturacion {
  return {
    id: 'regla-1',
    nombre: 'Cuota mensual',
    descripcion: null,
    ciclo_lectivo: '2026',
    concepto_cobro_id: 'concepto-1',
    importe: '110000.00',
    periodicidad: 'mensual',
    vigencia_desde: '2026-03-01',
    vigencia_hasta: '2026-12-31',
    mes_aplicacion: null,
    modo_generacion: 'manual',
    dia_generacion: null,
    dia_vencimiento: 10,
    criterio_aplicacion: 'todas_inscripciones',
    nivel_educativo_id: null,
    anio_id: null,
    division_id: null,
    estado: 'activa',
    proxima_generacion: null,
    ultima_ejecucion: null,
    ...sobrescribir,
  }
}

const activa = crearRegla({ id: 'regla-1', nombre: 'Cuota mensual' })
const finalizada = crearRegla({
  id: 'regla-2',
  nombre: 'Cuota 2025',
  ciclo_lectivo: '2025',
  estado: 'finalizada',
})

function renderizar() {
  return render(
    <MemoryRouter>
      <TooltipProvider>
        <ReglasFacturacionPage />
      </TooltipProvider>
    </MemoryRouter>,
  )
}

describe('ReglasFacturacionPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(listarReglasFacturacion).mockResolvedValue([activa, finalizada])
    vi.mocked(actualizarEstadoReglaFacturacion).mockResolvedValue(activa)
  })

  it('oculta las finalizadas por defecto y las muestra con "Todas"', async () => {
    const usuario = userEvent.setup()
    renderizar()

    expect(await screen.findByText('Cuota mensual')).toBeInTheDocument()
    expect(screen.queryByText('Cuota 2025')).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Vigentes · 1' })).toBeInTheDocument()

    await usuario.click(screen.getByRole('radio', { name: 'Todas · 2' }))

    expect(screen.getByText('Cuota 2025')).toBeInTheDocument()
  })

  it('pausa desde el icono sin abrir el detalle', async () => {
    const usuario = userEvent.setup()
    renderizar()

    await usuario.click(await screen.findByRole('button', { name: 'Pausar' }))

    await waitFor(() =>
      expect(actualizarEstadoReglaFacturacion).toHaveBeenCalledWith('regla-1', 'pausada'),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('abre el detalle al hacer click en la fila', async () => {
    const usuario = userEvent.setup()
    renderizar()

    await usuario.click(await screen.findByText('Cuota mensual'))

    expect(screen.getByRole('dialog')).toHaveTextContent('Detalle de Cuota mensual')
  })

  it('no muestra el botón de pausar en las finalizadas', async () => {
    const usuario = userEvent.setup()
    renderizar()
    await usuario.click(await screen.findByRole('radio', { name: 'Todas · 2' }))

    expect(screen.getAllByRole('button', { name: 'Pausar' })).toHaveLength(1)
  })
})
