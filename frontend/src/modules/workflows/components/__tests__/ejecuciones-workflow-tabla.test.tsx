import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { abrirMenuDeFila, elegirAccion } from '@/modules/workflows/__tests__/menu-acciones'
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
  aprobable: false,
  resumen_evento: [],
  recargo_estimado: null,
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
      puedeActualizar
      reintentandoId={null}
      onReintentar={vi.fn()}
      decidiendoId={null}
      onAprobar={vi.fn()}
      onRechazar={vi.fn()}
      {...props}
    />,
  )
}

describe('EjecucionesWorkflowTabla', () => {
  it('muestra regla, evento con nombre para el usuario y estado', async () => {
    renderTabla()

    expect(screen.getByText('Aviso de mora')).toBeInTheDocument()
    expect(screen.getByText('Vence una factura')).toBeInTheDocument()
    expect(screen.getByText('Fallida')).toBeInTheDocument()
  })

  it('muestra el resumen del evento debajo del nombre de la regla', async () => {
    renderTabla({
      items: [
        {
          ...ejecucionFallida,
          resumen_evento: [
            { nombre_interno: 'nombre_familia', etiqueta: 'Familia', valor: 'Castro' },
            { nombre_interno: 'dias_vencido', etiqueta: 'Días', valor: '16' },
            { nombre_interno: 'monto_deuda', etiqueta: 'Monto', valor: '120.000,00' },
          ],
        },
      ],
    })

    expect(screen.getByText('Castro · 16 días · $ 120.000,00')).toBeInTheDocument()
  })

  it('llama a onVerDetalle con la ejecución', async () => {
    const onVerDetalle = vi.fn()
    renderTabla({ onVerDetalle })

    await elegirAccion(/Ver detalle/)

    expect(onVerDetalle).toHaveBeenCalledWith(ejecucionFallida)
  })

  it('abre el detalle al hacer click en la fila', async () => {
    const onVerDetalle = vi.fn()
    renderTabla({ onVerDetalle })

    await userEvent.click(screen.getByText('Aviso de mora'))

    expect(onVerDetalle).toHaveBeenCalledWith(ejecucionFallida)
  })

  it('abrir el menú de acciones no abre el detalle', async () => {
    const onVerDetalle = vi.fn()
    renderTabla({ onVerDetalle })

    await abrirMenuDeFila()

    expect(onVerDetalle).not.toHaveBeenCalled()
  })

  it('cambia de página', async () => {
    const onCambiarPagina = vi.fn()
    renderTabla({ pagina: 1, total: 60, totalPaginas: 3, onCambiarPagina })

    await userEvent.click(screen.getByText('2'))

    expect(onCambiarPagina).toHaveBeenCalledWith(2)
  })

  it('ofrece "Reintentar" solo si es reintentable y hay permiso', async () => {
    const onReintentar = vi.fn()
    const reintentable = { ...ejecucionFallida, reintentable: true }
    const { rerender } = renderTabla({ items: [reintentable], onReintentar })

    await elegirAccion(/Reintentar/)
    expect(onReintentar).toHaveBeenCalledWith(reintentable)

    rerender(
      <EjecucionesWorkflowTabla
        items={[reintentable]}
        cargando={false}
        pagina={1}
        tamanioPagina={20}
        total={1}
        totalPaginas={1}
        onCambiarPagina={vi.fn()}
        onVerDetalle={vi.fn()}
        puedeActualizar={false}
        reintentandoId={null}
        onReintentar={onReintentar}
        decidiendoId={null}
        onAprobar={vi.fn()}
        onRechazar={vi.fn()}
      />,
    )
    await abrirMenuDeFila()
    expect(screen.queryByRole('menuitem', { name: /Reintentar/ })).not.toBeInTheDocument()
  })

  it('no ofrece "Reintentar" si la ejecución no es reintentable', async () => {
    renderTabla()

    await abrirMenuDeFila()

    expect(screen.queryByRole('menuitem', { name: /Reintentar/ })).not.toBeInTheDocument()
  })

  it('deshabilita el botón mientras se reintenta esa ejecución', async () => {
    renderTabla({ items: [{ ...ejecucionFallida, reintentable: true }], reintentandoId: 'ej-1' })

    await abrirMenuDeFila()

    expect(screen.getByRole('menuitem', { name: /Reintentar/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  describe('aprobación', () => {
    const aprobable: EjecucionWorkflow = {
      ...ejecucionFallida,
      estado: 'pendiente',
      error_detail: null,
      aprobable: true,
    }

    it('ofrece aprobar y rechazar una ejecución aprobable y avisa con la ejecución', async () => {
      const onAprobar = vi.fn()
      const onRechazar = vi.fn()
      renderTabla({ items: [aprobable], onAprobar, onRechazar })

      await elegirAccion(/Aprobar/)
      await elegirAccion(/Rechazar/)

      expect(onAprobar).toHaveBeenCalledWith(aprobable)
      expect(onRechazar).toHaveBeenCalledWith(aprobable)
    })

    it('no los ofrece si la ejecución no es aprobable', async () => {
      renderTabla({ items: [{ ...aprobable, aprobable: false }] })

      await abrirMenuDeFila()

      expect(screen.queryByRole('menuitem', { name: /Aprobar|Rechazar/ })).not.toBeInTheDocument()
    })

    it('no los ofrece sin permiso de actualizar', async () => {
      renderTabla({ items: [aprobable], puedeActualizar: false })

      await abrirMenuDeFila()

      expect(screen.queryByRole('menuitem', { name: /Aprobar|Rechazar/ })).not.toBeInTheDocument()
    })

    it('deshabilita los botones mientras se decide una ejecución', async () => {
      renderTabla({ items: [aprobable], decidiendoId: 'ej-1' })

      await abrirMenuDeFila()

      expect(screen.getByRole('menuitem', { name: /Aprobar/ })).toHaveAttribute(
        'aria-disabled',
        'true',
      )
      expect(screen.getByRole('menuitem', { name: /Rechazar/ })).toHaveAttribute(
        'aria-disabled',
        'true',
      )
    })
  })
})
