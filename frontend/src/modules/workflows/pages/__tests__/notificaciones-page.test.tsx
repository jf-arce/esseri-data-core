import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { NotificacionesPage } from '@/modules/workflows/pages/notificaciones-page'
import { listarNotificaciones } from '@/modules/workflows/services/listar-notificaciones'
import { obtenerNotificacion } from '@/modules/workflows/services/obtener-notificacion'
import type {
  NotificacionEnviada,
  NotificacionEnviadaDetalle,
  NotificacionEnviadaListado,
} from '@/modules/workflows/types'

vi.mock('@/modules/workflows/services/listar-notificaciones')
vi.mock('@/modules/workflows/services/obtener-notificacion')

const mockedListar = vi.mocked(listarNotificaciones)
const mockedObtener = vi.mocked(obtenerNotificacion)

function notificacion(id: string, destinatario: string): NotificacionEnviada {
  return {
    id,
    destinatario_tipo: 'usuario',
    canal: 'email',
    destinatario_snapshot: destinatario,
    asunto_snapshot: `Asunto de ${id}`,
    estado_envio: 'enviado',
    sent_at: '2026-09-01T10:00:00',
    familia_id: null,
    usuario_id: 'u-1',
    workflow_execution_id: 'ej-1',
    intento: 1,
    ejecucion_started_at: '2026-09-01T10:00:00',
    workflow_rule_id: 'r-1',
    workflow_rule_nombre: 'Aviso de mora',
  }
}

function detalle(id: string, destinatario: string, cuerpo: string): NotificacionEnviadaDetalle {
  return { ...notificacion(id, destinatario), cuerpo_snapshot: cuerpo }
}

const listado: NotificacionEnviadaListado = {
  items: [notificacion('n-1', 'ana@esseri.edu.ar'), notificacion('n-2', 'beto@esseri.edu.ar')],
  total: 60,
  pagina: 1,
  tamanio_pagina: 20,
  total_paginas: 3,
}

function renderPagina() {
  return render(
    <MemoryRouter>
      <NotificacionesPage />
    </MemoryRouter>,
  )
}

async function elegirFiltro(filtro: string, opcion: string) {
  await userEvent.click(screen.getByRole('button', { name: new RegExp(filtro) }))
  await userEvent.click(await screen.findByRole('radio', { name: opcion }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedListar.mockResolvedValue(listado)
})

describe('NotificacionesPage', () => {
  it('al cambiar un filtro vuelve a la página 1', async () => {
    renderPagina()
    await userEvent.click(await screen.findByRole('link', { name: '2' }))
    await waitFor(() => expect(mockedListar.mock.lastCall?.[0].pagina).toBe(2))

    await elegirFiltro('Estado', 'Fallida')
    await waitFor(() =>
      expect(mockedListar.mock.lastCall?.[0]).toMatchObject({ estadoEnvio: 'fallido', pagina: 1 }),
    )

    await userEvent.click(await screen.findByRole('link', { name: '2' }))
    await waitFor(() => expect(mockedListar.mock.lastCall?.[0].pagina).toBe(2))
    await elegirFiltro('Destinatario', 'Familia')

    await waitFor(() =>
      expect(mockedListar.mock.lastCall?.[0]).toMatchObject({
        estadoEnvio: 'fallido',
        destinatarioTipo: 'familia',
        pagina: 1,
      }),
    )
  })

  it('muestra el estado vacío cuando no hay notificaciones', async () => {
    mockedListar.mockResolvedValue({ ...listado, items: [], total: 0, total_paginas: 0 })

    renderPagina()

    expect(await screen.findByText('Todavía no se envió ninguna notificación.')).toBeInTheDocument()
  })

  it('con filtros sin resultados mantiene la tabla y avisa', async () => {
    renderPagina()
    await screen.findByText('ana@esseri.edu.ar')
    mockedListar.mockResolvedValue({ ...listado, items: [], total: 0, total_paginas: 0 })

    await elegirFiltro('Estado', 'Pendiente')

    expect(await screen.findByText('Ninguna notificación coincide con los filtros.')).toBeVisible()
  })

  it('muestra el aviso de permiso ante un 403', async () => {
    mockedListar.mockRejectedValue(new ApiError(403, 'Sin permiso'))

    renderPagina()

    expect(
      await screen.findByText('No tenés permiso para ver las notificaciones enviadas.'),
    ).toBeInTheDocument()
  })

  it('muestra el error y permite reintentar la carga', async () => {
    mockedListar.mockRejectedValueOnce(new ApiError(500, 'Falló la base'))

    renderPagina()
    expect(await screen.findByText('Falló la base')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('ana@esseri.edu.ar')).toBeInTheDocument()
  })

  it('abre el detalle y muestra el cuerpo', async () => {
    mockedObtener.mockResolvedValue(detalle('n-1', 'ana@esseri.edu.ar', 'Debe 1500\nVence hoy'))
    renderPagina()

    await userEvent.click((await screen.findAllByRole('button', { name: /Ver detalle/ }))[0])

    const dialogo = await screen.findByRole('dialog')
    expect(await screen.findByText(/Debe 1500/)).toBeInTheDocument()
    expect(dialogo).toHaveTextContent('Aviso de mora')
    expect(mockedObtener).toHaveBeenCalledWith('n-1', expect.any(AbortSignal))
  })

  it('muestra el error cuando falla el detalle', async () => {
    mockedObtener.mockRejectedValue(new ApiError(404, 'La notificación indicada no existe.'))
    renderPagina()

    await userEvent.click((await screen.findAllByRole('button', { name: /Ver detalle/ }))[0])

    expect(await screen.findByText('La notificación indicada no existe.')).toBeInTheDocument()
  })

  it('abrir A y después B antes de que A responda muestra solo el cuerpo de B', async () => {
    let resolverA: (valor: NotificacionEnviadaDetalle) => void = () => {}
    mockedObtener.mockImplementation((id) =>
      id === 'n-1'
        ? new Promise((resolver) => {
            resolverA = resolver
          })
        : Promise.resolve(detalle('n-2', 'beto@esseri.edu.ar', 'Cuerpo de B')),
    )
    renderPagina()
    const botones = await screen.findAllByRole('button', { name: /Ver detalle/ })

    await userEvent.click(botones[0])
    await userEvent.keyboard('{Escape}')
    await userEvent.click(botones[1])
    expect(await screen.findByText('Cuerpo de B')).toBeInTheDocument()

    resolverA(detalle('n-1', 'ana@esseri.edu.ar', 'Cuerpo de A'))

    await waitFor(() => expect(screen.queryByText('Cuerpo de A')).not.toBeInTheDocument())
    expect(screen.getByText('Cuerpo de B')).toBeInTheDocument()
  })

  it('cerrar y reabrir vuelve a mostrar el cuerpo', async () => {
    mockedObtener.mockResolvedValue(detalle('n-1', 'ana@esseri.edu.ar', 'Debe 1500'))
    renderPagina()
    const boton = (await screen.findAllByRole('button', { name: /Ver detalle/ }))[0]

    await userEvent.click(boton)
    expect(await screen.findByText('Debe 1500')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await userEvent.click(boton)

    expect(await screen.findByText('Debe 1500')).toBeInTheDocument()
  })
})
