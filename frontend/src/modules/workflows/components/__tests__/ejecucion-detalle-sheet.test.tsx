import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EjecucionDetalleSheet } from '@/modules/workflows/components/ejecucion-detalle-sheet'
import { obtenerEjecucionWorkflow } from '@/modules/workflows/services/obtener-ejecucion-workflow'
import type { EjecucionWorkflow } from '@/modules/workflows/types'

vi.mock('@/modules/workflows/services/obtener-ejecucion-workflow')

const mockedObtener = vi.mocked(obtenerEjecucionWorkflow)

const pendiente: EjecucionWorkflow = {
  id: 'ej-1',
  intento: 1,
  started_at: '2026-09-01T10:00:00Z',
  finished_at: null,
  estado: 'pendiente',
  detalle: 'Esperando aprobación humana.',
  error_detail: null,
  workflow_rule_id: 'r-1',
  workflow_rule_nombre: 'Aplicar penalidad',
  tipo_accion: 'aplicar_penalidad',
  event_log_id: 'ev-1',
  tipo_evento: 'factura.vencida',
  evento_timestamp: '2026-09-01T09:59:00Z',
  entidad: 'factura',
  entidad_id: 'f-1',
  reintentable: false,
  aprobable: true,
  resumen_evento: [
    { nombre_interno: 'dias_vencido', etiqueta: 'Días de deuda', valor: '16' },
    { nombre_interno: 'monto_deuda', etiqueta: 'Monto adeudado', valor: '120.000,00' },
  ],
  recargo_estimado: null,
}

function renderSheet(ejecucion: EjecucionWorkflow) {
  return render(
    <MemoryRouter>
      <EjecucionDetalleSheet
        ejecucion={ejecucion}
        onCerrar={vi.fn()}
        puedeActualizar
        decidiendoId={null}
        onAprobar={vi.fn()}
        onRechazar={vi.fn()}
      />
    </MemoryRouter>,
  )
}

describe('EjecucionDetalleSheet', () => {
  beforeEach(() => {
    mockedObtener.mockReset()
  })

  it('muestra los datos del evento con la unidad de cada campo', async () => {
    mockedObtener.mockResolvedValue(pendiente)
    renderSheet(pendiente)

    expect(await screen.findByText('Datos del evento')).toBeInTheDocument()
    expect(screen.getByText('16 días')).toBeInTheDocument()
    expect(screen.getByText('$ 120.000,00')).toBeInTheDocument()
  })

  it('pide el detalle y muestra el recargo estimado de una penalidad pendiente', async () => {
    mockedObtener.mockResolvedValue({ ...pendiente, recargo_estimado: '36000.00' })
    renderSheet(pendiente)

    expect(await screen.findByText('Recargo a aplicar')).toBeInTheDocument()
    expect(screen.getByText(/36\.000,00/)).toBeInTheDocument()
    expect(screen.getByText('estimado al aprobar')).toBeInTheDocument()
    expect(mockedObtener).toHaveBeenCalledWith('ej-1', expect.any(AbortSignal))
  })

  it('no muestra el recargo si la ejecución ya no está pendiente', async () => {
    mockedObtener.mockResolvedValue({ ...pendiente, estado: 'exitoso', recargo_estimado: null })
    renderSheet({ ...pendiente, estado: 'exitoso', aprobable: false })

    await screen.findByText('Datos del evento')
    expect(screen.queryByText('Recargo a aplicar')).not.toBeInTheDocument()
  })

  it('sigue mostrando el detalle del listado si falla el pedido', async () => {
    mockedObtener.mockRejectedValue(new Error('falló'))
    renderSheet(pendiente)

    expect(await screen.findByText('Datos del evento')).toBeInTheDocument()
    expect(screen.queryByText('Recargo a aplicar')).not.toBeInTheDocument()
  })
})
