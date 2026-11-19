import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { CobranzasPage } from '@/modules/facturacion/pages/cobranzas-page'

vi.mock('@/modules/facturacion/pages/debitos-generar-page', () => ({
  DebitosGenerarPage: ({ onIrAImportar }: { onIrAImportar: () => void }) => (
    <div>
      <p>Contenido generar</p>
      <button type="button" onClick={onIrAImportar}>
        Ir a importar desde generar
      </button>
    </div>
  ),
}))

vi.mock('@/modules/facturacion/pages/debitos-importar-page', () => ({
  DebitosImportarPage: ({ importacionId }: { importacionId: string | null }) => (
    <p>Contenido importar {importacionId ?? 'sin-id'}</p>
  ),
}))

vi.mock('@/modules/facturacion/pages/debitos-historial-page', () => ({
  DebitosHistorialPage: ({
    onContinuarRevision,
  }: {
    onContinuarRevision: (id: string) => void
  }) => (
    <button type="button" onClick={() => onContinuarRevision('imp-9')}>
      Continuar revisión simulada
    </button>
  ),
}))

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.search}</output>
}

function renderPage(initialEntry = '/facturacion/cobranzas') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <CobranzasPage />
      <LocationProbe />
    </MemoryRouter>,
  )
}

describe('CobranzasPage', () => {
  it('presenta el título, las tres pestañas y conserva el acceso desde facturas', () => {
    renderPage()

    expect(screen.getByRole('heading', { name: 'Débitos automáticos' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Generar lote' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Importar resultados' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Historial de lotes' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a facturas' })).toHaveAttribute(
      'href',
      '/facturacion',
    )
    expect(screen.getByText('Contenido generar')).toBeInTheDocument()
  })

  it('guarda la pestaña activa en la URL y restaura la revisión durable', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('tab', { name: 'Importar resultados' }))

    expect(screen.getByText('Contenido importar sin-id')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('pestana=importar')

    await user.click(screen.getByRole('tab', { name: 'Historial de lotes' }))
    await user.click(screen.getByRole('button', { name: 'Continuar revisión simulada' }))

    expect(await screen.findByText('Contenido importar imp-9')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('importacion=imp-9')
  })

  it('restaura pestaña e importación desde los parámetros y cae en generar si son inválidos', () => {
    const { unmount } = renderPage('/facturacion/cobranzas?pestana=importar&importacion=imp-1')
    expect(screen.getByText('Contenido importar imp-1')).toBeInTheDocument()
    unmount()

    renderPage('/facturacion/cobranzas?pestana=otra-cosa')
    expect(screen.getByText('Contenido generar')).toBeInTheDocument()
  })
})
