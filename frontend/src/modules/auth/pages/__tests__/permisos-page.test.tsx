import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermisosPage } from '@/modules/auth/pages/permisos-page'
import { getPermisos } from '@/modules/auth/services/get-permisos'

vi.mock('@/modules/auth/services/get-permisos')

const mockedGetPermisos = vi.mocked(getPermisos)

function renderPagina(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <PermisosPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedGetPermisos.mockResolvedValue([])
})

describe('PermisosPage', () => {
  it('no abre el diálogo de alta al entrar sin parámetros', () => {
    renderPagina('/usuarios-roles/permisos')

    expect(screen.queryByRole('heading', { name: 'Nuevo permiso' })).not.toBeInTheDocument()
  })

  // El buscador global (Cmd/Ctrl+K → "Nuevo permiso") linkea acá con `?crear=1`: la página
  // tiene que abrir el diálogo de alta sola, ya que el permiso no tiene una ruta de alta propia.
  it('abre el diálogo de alta cuando llega con ?crear=1', () => {
    renderPagina('/usuarios-roles/permisos?crear=1')

    expect(screen.getByRole('heading', { name: 'Nuevo permiso' })).toBeInTheDocument()
  })
})
