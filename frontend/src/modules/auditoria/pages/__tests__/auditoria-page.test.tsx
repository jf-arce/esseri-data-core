import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { AuditoriaPage } from '@/modules/auditoria/pages/auditoria-page'
import { listarAuditoria } from '@/modules/auditoria/services/listar-auditoria'
import { obtenerOpcionesAuditoria } from '@/modules/auditoria/services/obtener-opciones-auditoria'
import type { AuditoriaListado } from '@/modules/auditoria/types'

vi.mock('@/modules/auditoria/services/listar-auditoria')
vi.mock('@/modules/auditoria/services/obtener-opciones-auditoria')

const mockedListar = vi.mocked(listarAuditoria)
const mockedOpciones = vi.mocked(obtenerOpcionesAuditoria)

const listado: AuditoriaListado = {
  items: [
    {
      id: 'log-1',
      entidad: 'alumno',
      entidad_id: 'alumno-1',
      campo: 'estado',
      valor_anterior: 'activo',
      valor_nuevo: 'inactivo',
      fecha: '2027-01-01T10:00:00',
      usuario_id: 'u1',
      usuario_email: 'admin@esseri.edu.ar',
      actor_tipo: 'usuario',
      origen: 'edicion_manual',
      motivo: 'Corrección solicitada por la familia.',
      referencia_entidad: null,
      referencia_id: null,
    },
  ],
  total: 60,
  pagina: 1,
  tamanio_pagina: 20,
  total_paginas: 3,
}

function renderPagina() {
  return render(
    <MemoryRouter>
      <AuditoriaPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedListar.mockResolvedValue(listado)
  mockedOpciones.mockResolvedValue({
    entidades: ['alumno'],
    campos: ['estado'],
    origenes: ['edicion_manual'],
    usuarios: [{ id: 'u1', email: 'admin@esseri.edu.ar' }],
  })
})

describe('AuditoriaPage', () => {
  it('al cambiar la búsqueda vuelve a la página 1', async () => {
    renderPagina()
    await screen.findByText('Estado')

    await userEvent.click(screen.getByText('2'))
    await waitFor(() => expect(mockedListar.mock.lastCall?.[0].pagina).toBe(2))

    await userEvent.type(screen.getByPlaceholderText(/Buscar entidad/), 'beca')

    await waitFor(() =>
      expect(mockedListar.mock.lastCall?.[0]).toMatchObject({ busqueda: 'beca', pagina: 1 }),
    )
  })

  it('abre el detalle de un registro', async () => {
    renderPagina()
    await screen.findByText('Estado')

    await userEvent.click(screen.getByRole('button', { name: /Ver detalle del cambio/ }))

    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'Corrección solicitada por la familia.',
    )
  })

  it('muestra un mensaje de permiso cuando el backend responde 403', async () => {
    mockedListar.mockRejectedValue(new ApiError(403, 'Sin permiso'))

    renderPagina()

    expect(
      await screen.findByText('No tenés permiso para ver la auditoría del sistema.'),
    ).toBeInTheDocument()
  })
})
