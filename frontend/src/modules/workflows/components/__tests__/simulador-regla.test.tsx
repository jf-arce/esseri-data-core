import { ReactFlow, ReactFlowProvider } from '@xyflow/react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SimuladorRegla } from '@/modules/workflows/components/simulador-regla'
import type { useSimulacionRegla } from '@/modules/workflows/hooks/use-simulacion-regla'
import { BORRADOR_VACIO } from '@/modules/workflows/utils-grafo'

vi.mock('@/modules/workflows/services/listar-eventos-recientes')

const SIMULACION_VACIA: ReturnType<typeof useSimulacionRegla> = {
  simulacion: null,
  nodos: null,
  aristas: null,
  orden: [],
  desactualizada: false,
  enCurso: false,
  cargando: false,
  error: null,
  simular: vi.fn(),
  limpiar: vi.fn(),
}

function renderizar() {
  return render(
    <ReactFlowProvider>
      <ReactFlow nodes={[]} edges={[]}>
        <SimuladorRegla
          borrador={BORRADOR_VACIO}
          evento={undefined}
          simulacion={SIMULACION_VACIA}
          deshabilitado={false}
          anchoTapado={0}
        />
      </ReactFlow>
    </ReactFlowProvider>,
  )
}

describe('SimuladorRegla', () => {
  it('arranca minimizado y se despliega con "Probar regla"', async () => {
    renderizar()
    expect(screen.queryByRole('region', { name: 'Probar regla' })).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Probar con este evento' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Probar regla' }))
    expect(screen.getByRole('combobox', { name: 'Probar con este evento' })).toBeVisible()
  })

  it('se minimiza con el botón y se vuelve a desplegar', async () => {
    renderizar()
    await userEvent.click(screen.getByRole('button', { name: 'Probar regla' }))
    await userEvent.click(screen.getByRole('button', { name: 'Minimizar panel de prueba' }))
    expect(screen.queryByRole('combobox', { name: 'Probar con este evento' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Probar regla' }))
    expect(screen.getByRole('combobox', { name: 'Probar con este evento' })).toBeVisible()
  })
})
