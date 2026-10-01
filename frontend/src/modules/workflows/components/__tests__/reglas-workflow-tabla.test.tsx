import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { ReglasWorkflowTabla } from '@/modules/workflows/components/reglas-workflow-tabla'
import type { ReglaWorkflow, TipoEvento } from '@/modules/workflows/types'

const tiposEvento: TipoEvento[] = [
  { id: 'e-1', nombre: 'factura.vencida', descripcion: null, campos: [] },
]

const regla: ReglaWorkflow = {
  id: 'r-1',
  nombre: 'Penalidad por mora',
  tipo_evento_id: 'e-1',
  condicion: {},
  tipo_accion: 'aplicar_penalidad',
  accion_config: {},
  criticidad: 'alta',
  requiere_aprobacion_humana: true,
  notificacion_template_id: null,
  activo: true,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}

function renderizar(puedeActualizar: boolean) {
  return render(
    <MemoryRouter>
      <ReglasWorkflowTabla
        reglas={[regla]}
        tiposEvento={tiposEvento}
        cargando={false}
        puedeActualizar={puedeActualizar}
        onCambiarActivo={vi.fn()}
      />
    </MemoryRouter>,
  )
}

describe('ReglasWorkflowTabla', () => {
  it('muestra evento, acción, criticidad y aprobación humana de la regla', () => {
    renderizar(true)

    expect(screen.getByText('Penalidad por mora')).toBeInTheDocument()
    expect(screen.getByText('Vence una factura')).toBeInTheDocument()
    expect(screen.getByText('Aplicar penalidad')).toBeInTheDocument()
    expect(screen.getByText('Alta')).toBeInTheDocument()
    expect(screen.getByText('Sí')).toBeInTheDocument()
  })

  it('con permiso de actualización ofrece editar y desactivar', () => {
    renderizar(true)

    expect(screen.getByRole('link', { name: 'Editar' })).toHaveAttribute(
      'href',
      '/workflows/reglas/r-1',
    )
    expect(screen.getByRole('button', { name: 'Desactivar' })).toBeInTheDocument()
  })

  it('sin permiso de actualización solo ofrece ver', () => {
    renderizar(false)

    expect(screen.getByRole('link', { name: 'Ver' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desactivar' })).not.toBeInTheDocument()
  })
})
