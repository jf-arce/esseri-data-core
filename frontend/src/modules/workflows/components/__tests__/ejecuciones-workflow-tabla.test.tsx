import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EjecucionesWorkflowTabla } from '@/modules/workflows/components/ejecuciones-workflow-tabla'
import type { EjecucionWorkflow } from '@/modules/workflows/types'

const ejecucionFallida: EjecucionWorkflow = {
  id: 'ej-1',
  intento: 1,
  started_at: '2026-09-01T10:00:00Z',
  finished_at: '2026-09-01T10:00:01Z',
  estado: 'fallido',
  detalle: null,
  error_detail: 'La acción no pudo completarse.',
  workflow_rule_id: 'r-1',
  workflow_rule_nombre: 'Aviso de mora',
  tipo_accion: 'notificar',
  event_log_id: 'ev-1',
  tipo_evento: 'factura.vencida',
  evento_timestamp: '2026-09-01T09:59:00Z',
  entidad: 'factura',
  entidad_id: 'f-1',
  reintentable: false,
}

function renderTabla(props: Partial<Parameters<typeof EjecucionesWorkflowTabla>[0]> = {}) {
  return render(
    <EjecucionesWorkflowTabla
      items={[ejecucionFallida]}
      cargando={false}
      pagina={1}
      tamanioPagina={20}
      total={1}
      totalPaginas={1}
      onCambiarPagina={vi.fn()}
      onVerDetalle={vi.fn()}
      {...props}
    />,
  )
}

describe('EjecucionesWorkflowTabla', () => {
  it('muestra regla, evento con nombre para el usuario y estado', () => {
    renderTabla()

    expect(screen.getByText('Aviso de mora')).toBeInTheDocument()
    expect(screen.getByText('Vence una factura')).toBeInTheDocument()
    expect(screen.getByText('Fallida')).toBeInTheDocument()
  })

  it('llama a onVerDetalle con la ejecución', async () => {
    const onVerDetalle = vi.fn()
    renderTabla({ onVerDetalle })

    await userEvent.click(screen.getByRole('button', { name: /Ver detalle/ }))

    expect(onVerDetalle).toHaveBeenCalledWith(ejecucionFallida)
  })

  it('cambia de página', async () => {
    const onCambiarPagina = vi.fn()
    renderTabla({ pagina: 1, total: 60, totalPaginas: 3, onCambiarPagina })

    await userEvent.click(screen.getByText('2'))

    expect(onCambiarPagina).toHaveBeenCalledWith(2)
  })
})
