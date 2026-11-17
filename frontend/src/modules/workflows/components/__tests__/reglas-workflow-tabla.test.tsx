import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { abrirMenuDeFila } from '@/modules/workflows/__tests__/menu-acciones'
import { describe, expect, it, vi } from 'vitest'
import { ReglasWorkflowTabla } from '@/modules/workflows/components/reglas-workflow-tabla'
import { nodoAccion, reglaDe } from '@/modules/workflows/__tests__/fabricas'
import type { TipoEvento } from '@/modules/workflows/types'

const tiposEvento: TipoEvento[] = [
  { id: 'e-1', nombre: 'factura.vencida', descripcion: null, campos: [] },
]

const regla = reglaDe({
  nombre: 'Penalidad por mora',
  nodos: [
    nodoAccion('n-1', { tipo_accion: 'aplicar_penalidad', requiere_aprobacion_humana: true }),
  ],
})

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
  it('muestra evento, acción y aprobación humana de la regla', async () => {
    renderizar(true)

    expect(screen.getByText('Penalidad por mora')).toBeInTheDocument()
    expect(screen.getByText('Vence una factura')).toBeInTheDocument()
    expect(screen.getByText('Aplicar penalidad')).toBeInTheDocument()
    expect(screen.getByText('Sí')).toBeInTheDocument()
  })

  it('con permiso de actualización ofrece editar y desactivar', async () => {
    renderizar(true)

    await abrirMenuDeFila()
    expect(screen.getByRole('menuitem', { name: 'Editar' })).toHaveAttribute(
      'href',
      '/workflows/reglas/r-1',
    )
    expect(screen.getByRole('menuitem', { name: 'Desactivar' })).toBeInTheDocument()
  })

  it('sin permiso de actualización solo ofrece ver', async () => {
    renderizar(false)

    await abrirMenuDeFila()
    expect(screen.getByRole('menuitem', { name: 'Ver' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Desactivar' })).not.toBeInTheDocument()
  })
})
