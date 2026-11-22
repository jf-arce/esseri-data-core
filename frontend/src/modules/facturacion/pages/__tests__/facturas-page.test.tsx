import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FacturasPage } from '@/modules/facturacion/pages/facturas-page'
import { listarConceptosCobro } from '@/modules/facturacion/services/listar-conceptos-cobro'
import { listarFacturas } from '@/modules/facturacion/services/listar-facturas'
import { listarAlumnos } from '@/modules/familias-alumnos/services/listar-alumnos'
import { listarFamilias } from '@/modules/familias-alumnos/services/listar-familias'

vi.mock('@/modules/facturacion/services/listar-facturas')
vi.mock('@/modules/facturacion/services/listar-conceptos-cobro')
vi.mock('@/modules/familias-alumnos/services/listar-alumnos')
vi.mock('@/modules/familias-alumnos/services/listar-familias')

function renderizarPagina(entrada: string) {
  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <FacturasPage />
    </MemoryRouter>,
  )
}

describe('FacturasPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listarFacturas).mockResolvedValue({ items: [], total: 0, pagina: 1, tamanio: 10 })
    vi.mocked(listarConceptosCobro).mockResolvedValue([])
    vi.mocked(listarAlumnos).mockResolvedValue([])
    vi.mocked(listarFamilias).mockResolvedValue([])
  })

  it('filtra por la familia responsable indicada en la URL', async () => {
    renderizarPagina('/facturacion?familia_responsable_id=familia-1')

    await waitFor(() =>
      expect(listarFacturas).toHaveBeenCalledWith(
        expect.objectContaining({ familiaResponsableId: 'familia-1', pagina: 1 }),
        expect.any(AbortSignal),
      ),
    )
  })
})
