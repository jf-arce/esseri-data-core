import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TareasTabla } from '@/modules/workflows/components/tareas-tabla'
import type { Tarea } from '@/modules/workflows/types'

const tarea: Tarea = {
  id: 't-1',
  titulo: 'Llamar a la familia',
  descripcion: null,
  estado: 'pendiente',
  prioridad: 'alta',
  fecha_vencimiento: '2026-10-01T10:00:00',
  vencida: true,
  entidad: 'factura',
  entidad_id: 'f-1',
  usuario_id: 'u-1',
  usuario_email: 'admin@esseri.edu.ar',
  workflow_execution_id: 'ej-1',
  workflow_rule_nombre: 'Tarea por mora',
  tarea_id: null,
  created_at: '2026-09-30T10:00:00',
  updated_at: '2026-09-30T10:00:00',
}

function renderTabla(props: Partial<Parameters<typeof TareasTabla>[0]> = {}) {
  return render(
    <TareasTabla
      items={[tarea]}
      cargando={false}
      pagina={1}
      tamanioPagina={20}
      total={1}
      totalPaginas={1}
      onCambiarPagina={vi.fn()}
      onVerDetalle={vi.fn()}
      puedeAvanzar={() => true}
      avanzandoId={null}
      onAvanzar={vi.fn()}
      {...props}
    />,
  )
}

describe('TareasTabla', () => {
  it('muestra la tarea, su responsable, su regla, su prioridad y su estado', () => {
    renderTabla()

    expect(screen.getByText('Llamar a la familia')).toBeInTheDocument()
    expect(screen.getByText('Tarea por mora')).toBeInTheDocument()
    expect(screen.getByText('admin@esseri.edu.ar')).toBeInTheDocument()
    expect(screen.getByText('Alta')).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
  })

  it('marca como vencida la tarea abierta con la fecha pasada', () => {
    renderTabla()

    expect(screen.getByText('Vencida')).toBeInTheDocument()
  })

  it('ofrece iniciar y completar una tarea pendiente, y solo completar una en progreso', () => {
    const { rerender } = renderTabla()
    expect(screen.getByRole('button', { name: /Iniciar/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Completar/ })).toBeInTheDocument()

    rerender(
      <TareasTabla
        items={[{ ...tarea, estado: 'en_progreso' }]}
        cargando={false}
        pagina={1}
        tamanioPagina={20}
        total={1}
        totalPaginas={1}
        onCambiarPagina={vi.fn()}
        onVerDetalle={vi.fn()}
        puedeAvanzar={() => true}
        avanzandoId={null}
        onAvanzar={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: /Iniciar/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Completar/ })).toBeInTheDocument()
  })

  it('no ofrece avanzar las tareas cerradas ni las escaladas', () => {
    renderTabla({
      items: [
        { ...tarea, id: 't-2', estado: 'completada', vencida: false },
        { ...tarea, id: 't-3', estado: 'escalada', vencida: false },
      ],
    })

    expect(screen.queryByRole('button', { name: /Iniciar|Completar/ })).not.toBeInTheDocument()
  })

  it('no ofrece avanzar las tareas ajenas si la persona no puede gestionarlas', () => {
    renderTabla({ puedeAvanzar: () => false })

    expect(screen.queryByRole('button', { name: /Iniciar|Completar/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ver detalle/ })).toBeInTheDocument()
  })

  it('avisa qué tarea y a qué estado se quiere avanzar', async () => {
    const onAvanzar = vi.fn()
    renderTabla({ onAvanzar })

    await userEvent.click(screen.getByRole('button', { name: /Iniciar/ }))

    expect(onAvanzar).toHaveBeenCalledWith(tarea, 'en_progreso')
  })

  it('llama a onVerDetalle con la tarea', async () => {
    const onVerDetalle = vi.fn()
    renderTabla({ onVerDetalle })

    await userEvent.click(screen.getByRole('button', { name: /Ver detalle/ }))

    expect(onVerDetalle).toHaveBeenCalledWith(tarea)
  })
})
