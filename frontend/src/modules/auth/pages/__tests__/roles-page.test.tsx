import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RolesPage } from '@/modules/auth/pages/roles-page'
import { getRoles } from '@/modules/auth/services/get-roles'

vi.mock('@/modules/auth/services/get-roles')

const mockedGetRoles = vi.mocked(getRoles)

function renderPagina(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <RolesPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedGetRoles.mockResolvedValue([])
})

describe('RolesPage', () => {
  it('no abre el diálogo de alta al entrar sin parámetros', () => {
    renderPagina('/usuarios-roles/roles')

    expect(screen.queryByRole('heading', { name: 'Nuevo rol' })).not.toBeInTheDocument()
  })

  // El buscador global (Cmd/Ctrl+K → "Nuevo rol") linkea acá con `?crear=1`: la página tiene
  // que abrir el diálogo de alta sola, ya que el rol no tiene una ruta de alta propia.
  it('abre el diálogo de alta cuando llega con ?crear=1', () => {
    renderPagina('/usuarios-roles/roles?crear=1')

    expect(screen.getByRole('heading', { name: 'Nuevo rol' })).toBeInTheDocument()
  })
})
