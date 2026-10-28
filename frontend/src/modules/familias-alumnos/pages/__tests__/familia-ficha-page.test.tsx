import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FamiliaFichaPage } from '@/modules/familias-alumnos/pages/familia-ficha-page'
import { listarDeudaFamilias } from '@/modules/facturacion/services/listar-deuda-familias'
import { getFamiliaById } from '@/modules/familias-alumnos/services/create-familia'
import { listarVinculosFamilia } from '@/modules/familias-alumnos/services/listar-vinculos-familia'

vi.mock('@/modules/facturacion/services/listar-deuda-familias')
vi.mock('@/modules/familias-alumnos/services/create-familia')
vi.mock('@/modules/familias-alumnos/services/listar-vinculos-familia')
vi.mock('@/modules/familias-alumnos/hooks/use-alumnos', () => ({
  useAlumnos: () => ({ datos: [] }),
}))
vi.mock('@/modules/auditoria/components/historial-cambios', () => ({
  HistorialCambios: () => null,
}))

const familia = {
  id: 'familia-1',
  persona_id: 'persona-1',
  estado_deuda: null,
  persona_nombre: 'Alicia',
  persona_apellido: 'Pérez',
  persona_dni: '12345678',
  persona_telefono: null,
  persona_sexo: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const mockedObtenerFamilia = vi.mocked(getFamiliaById)
const mockedListarVinculos = vi.mocked(listarVinculosFamilia)
const mockedListarDeuda = vi.mocked(listarDeudaFamilias)

function renderizarPagina() {
  return render(
    <MemoryRouter initialEntries={['/familias-alumnos/familias/familia-1']}>
      <Routes>
        <Route path="/familias-alumnos/familias/:familiaId" element={<FamiliaFichaPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('FamiliaFichaPage', () => {
  it.each(['error', 'missing'] as const)(
    'does not display a zero balance for %s data',
    async (state) => {
      if (state === 'error') mockedListarDeuda.mockRejectedValue(new Error('Unavailable'))
      else mockedListarDeuda.mockResolvedValue({ items: [], total: 0, pagina: 1, tamanio: 1 })
      renderizarPagina()
      const label = await screen.findByText('Deuda total')
      await waitFor(() => expect(within(label.parentElement!).getByText('—')).toBeInTheDocument())
      expect(within(label.parentElement!).queryByText(/\$.*0,00/)).not.toBeInTheDocument()
      expect(screen.getByText('Facturas pendientes').parentElement).toHaveTextContent('—')
    },
  )

  beforeEach(() => {
    vi.clearAllMocks()
    mockedObtenerFamilia.mockResolvedValue(familia)
    mockedListarVinculos.mockResolvedValue([])
    mockedListarDeuda.mockResolvedValue({
      items: [
        {
          familia_id: 'familia-1',
          familia_nombre: 'Alicia Pérez',
          familia_apellido: 'Pérez',
          familia_dni: '12345678',
          deuda_total: '150.00',
          monto_pendiente: '50.00',
          monto_vencido: '100.00',
          monto_pagado: '25.00',
          facturas_pendientes: 2,
          facturas_pagadas: 0,
          estado: 'vencida',
        },
      ],
      total: 1,
      pagina: 1,
      tamanio: 1,
    })
  })

  it('habilita la facturación y muestra el resumen derivado de la cuenta corriente', async () => {
    renderizarPagina()

    const tab = await screen.findByRole('tab', { name: 'Facturación' })
    expect(tab).toBeEnabled()
    await waitFor(() =>
      expect(mockedListarDeuda).toHaveBeenCalledWith(
        { pagina: 1, tamanio: 1, buscar: '12345678' },
        expect.any(AbortSignal),
      ),
    )
  })
})
