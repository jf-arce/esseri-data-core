import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import type { ListadoEntrega } from '../../types'
import { EntregaComunicacion } from '../entrega-comunicacion'

vi.mock('@/api/client')
const api = vi.mocked(apiClient)

const resumenBase = {
  responsables: 0,
  responsables_con_email: 0,
  responsables_sin_email: 0,
  responsables_leidos: 0,
  responsables_no_leidos: 0,
  emails: 0,
  emails_aceptados: 0,
  emails_pendientes: 0,
  emails_fallidos: 0,
  emails_inciertos: 0,
  email_aplica: true,
  lectura_aplica: true,
}

function respuesta({ resumen, ...cambios }: Partial<ListadoEntrega> = {}): ListadoEntrega {
  return {
    items: [],
    total: 0,
    pagina: 1,
    total_paginas: 0,
    ...cambios,
    resumen: { ...resumenBase, ...(resumen ?? {}) },
  }
}

function tarjeta(nombre: string) {
  return screen.getByText(nombre, { selector: 'p' }).parentElement as HTMLElement
}

beforeEach(() => vi.resetAllMocks())

it('separates responsible counts from email outcomes and shows portal reading', async () => {
  api.mockResolvedValue(
    respuesta({
      items: [
        {
          id: 'r1',
          nombre: 'Ana Gómez',
          leida_at: '2026-10-30T12:05:00Z',
          emails: [
            { id: 'e1', email: 'ana@example.test', estado: 'presentado', intentos: [] },
            {
              id: 'e2',
              email: 'ana2@example.test',
              estado: 'fallido',
              intentos: [
                {
                  id: 'i1',
                  estado: 'fallido',
                  error_codigo: 'timeout',
                  started_at: '2026-10-30T11:00:00Z',
                  finished_at: '2026-10-30T11:01:00Z',
                },
              ],
            },
          ],
        },
        {
          id: 'r2',
          nombre: 'Familia Sin Correo',
          leida_at: null,
          emails: [{ id: 'e3', email: null, estado: 'sin_email', intentos: [] }],
        },
      ],
      resumen: {
        ...resumenBase,
        responsables: 2,
        responsables_con_email: 1,
        responsables_sin_email: 1,
        responsables_leidos: 1,
        responsables_no_leidos: 1,
        emails: 2,
        emails_aceptados: 1,
        emails_fallidos: 1,
      },
      total: 2,
      total_paginas: 1,
    }),
  )
  render(<EntregaComunicacion comunicacionId="c1" canal="ambos" />)
  expect(await screen.findByRole('region', { name: 'Entrega' })).toBeInTheDocument()
  expect(tarjeta('Destinatarios')).toHaveTextContent('2')
  expect(tarjeta('Enviados')).toHaveTextContent('1')
  expect(tarjeta('Rechazados')).toHaveTextContent('1')
  expect(tarjeta('Leídos')).toHaveTextContent('1')
  expect(tarjeta('Sin leer')).toHaveTextContent('1')
  expect(screen.getByRole('columnheader', { name: 'Estado mail' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Estado portal' })).toBeInTheDocument()
  expect(screen.getByText('Ana Gómez')).toBeInTheDocument()
  expect(screen.getByText('ana@example.test')).toBeInTheDocument()
  expect(screen.getByText('Enviado')).toBeInTheDocument()
  expect(screen.getByText('Falló')).toBeInTheDocument()
  expect(screen.getByText('Leído')).toBeInTheDocument()
  expect(screen.getByText('Leído')).toHaveAttribute('data-variant', 'exito')
  const noLeido = screen.getByText('No leído', { selector: 'td span' })
  expect(noLeido).toHaveAttribute('data-variant', 'advertencia')
  expect(screen.getByText('Sin email', { selector: 'span[data-variant]' })).toBeInTheDocument()
  expect(screen.queryByText('30/10/2026, 09:05')).not.toBeInTheDocument()
  const fallo = screen.getByLabelText('Estado de ana2@example.test: Falló')
  await userEvent.hover(fallo)
  expect(await screen.findByText(/Intento 1: Falló/)).toHaveTextContent('timeout')
  expect(screen.queryByText('Entregado')).not.toBeInTheDocument()
})

it('shows the portal read time only on hover', async () => {
  api.mockResolvedValue(
    respuesta({
      items: [
        {
          id: 'r1',
          nombre: 'Familia Prueba',
          leida_at: '2026-10-30T12:05:00Z',
          emails: [],
        },
      ],
      resumen: {
        ...resumenBase,
        responsables: 1,
        responsables_leidos: 1,
        email_aplica: true,
        lectura_aplica: true,
      },
      total: 1,
      total_paginas: 1,
    }),
  )
  render(<EntregaComunicacion comunicacionId="c1" canal="ambos" />)
  expect(await screen.findByText('Familia Prueba')).toBeInTheDocument()
  expect(screen.queryByText('30/10/2026, 09:05')).not.toBeInTheDocument()
  await userEvent.hover(screen.getByText('Leído', { selector: 'span[data-variant]' }))
  expect(await screen.findByText('Leído el 30/10/2026, 09:05')).toBeInTheDocument()
})

it('searches and filters on the server, resetting to the first page', async () => {
  api.mockResolvedValue(respuesta({ total: 12, total_paginas: 2 }))
  render(<EntregaComunicacion comunicacionId="c1" canal="ambos" />)
  await screen.findByRole('region', { name: 'Entrega' })
  await userEvent.type(
    screen.getByRole('searchbox', { name: 'Buscar destinatario o email' }),
    'Gómez',
  )
  await waitFor(() =>
    expect(api.mock.calls.some(([path]) => path.includes('buscar=G%C3%B3mez'))).toBe(true),
  )
  await userEvent.selectOptions(
    screen.getByRole('combobox', { name: 'Filtrar por estado' }),
    'fallidos',
  )
  await waitFor(() =>
    expect(api.mock.calls.some(([path]) => path.includes('filtro=fallidos'))).toBe(true),
  )
  expect(api.mock.calls.at(-1)?.[0]).toContain('pagina=1')
})

it('paginates responsible rows and retries only failed emails', async () => {
  api.mockImplementation(async (path) => {
    if (path.includes('/reintentar'))
      return { id: 'e1', email: 'familia@example.test', estado: 'pendiente', intentos: [] }
    return respuesta({
      items: [
        {
          id: 'r1',
          nombre: 'Familia Prueba',
          leida_at: null,
          emails: [{ id: 'e1', email: 'familia@example.test', estado: 'fallido', intentos: [] }],
        },
      ],
      resumen: {
        ...resumenBase,
        responsables: 12,
        responsables_con_email: 12,
        responsables_no_leidos: 12,
        emails: 12,
        emails_fallidos: 1,
      },
      total: 12,
      total_paginas: 2,
    })
  })
  render(<EntregaComunicacion comunicacionId="c1" canal="ambos" />)
  expect(await screen.findByText('familia@example.test')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Reintentar envío a/ }))
  await waitFor(() =>
    expect(
      api.mock.calls.some(
        ([path, options]) => path.includes('/reintentar') && options?.method === 'POST',
      ),
    ).toBe(true),
  )
  await waitFor(() =>
    expect(api.mock.calls.filter(([path]) => path.includes('/entrega')).length).toBeGreaterThan(1),
  )
  await userEvent.click(screen.getByRole('link', { name: '2' }))
  await waitFor(() => expect(api.mock.calls.some(([path]) => path.includes('pagina=2'))).toBe(true))
})

it('shows a recoverable error without losing the delivery screen', async () => {
  api
    .mockRejectedValueOnce(new Error('falló'))
    .mockResolvedValueOnce(respuesta({ total: 0, total_paginas: 0 }))
  render(<EntregaComunicacion comunicacionId="c1" canal="ambos" />)
  expect(await screen.findByText('No se pudo cargar la entrega.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText('No hay destinatarios para mostrar.')).toBeInTheDocument()
})

it('does not show portal reading when the communication is email-only', async () => {
  api.mockResolvedValue(
    respuesta({
      items: [
        {
          id: 'r1',
          nombre: 'Familia Prueba',
          leida_at: null,
          emails: [{ id: 'e1', email: 'familia@example.test', estado: 'presentado', intentos: [] }],
        },
      ],
      resumen: {
        ...resumenBase,
        responsables: 1,
        responsables_con_email: 1,
        emails: 1,
        emails_aceptados: 1,
        lectura_aplica: false,
      },
      total: 1,
      total_paginas: 1,
    }),
  )
  render(<EntregaComunicacion comunicacionId="c1" canal="email" />)
  expect(await screen.findByText('Familia Prueba')).toBeInTheDocument()
  expect(tarjeta('Destinatarios')).toHaveTextContent('1')
  expect(tarjeta('Enviados')).toHaveTextContent('1')
  expect(tarjeta('Rechazados')).toHaveTextContent('0')
  expect(screen.queryByText('Leídos', { selector: 'p' })).not.toBeInTheDocument()
  expect(screen.queryByText('Sin leer', { selector: 'p' })).not.toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Estado mail' })).toBeInTheDocument()
  expect(screen.queryByRole('columnheader', { name: 'Estado portal' })).not.toBeInTheDocument()
  expect(screen.queryByRole('option', { name: 'Leídos' })).not.toBeInTheDocument()
  expect(screen.queryByText('No leído')).not.toBeInTheDocument()
})

it('shows contact emails without send filters for portal-only communications', async () => {
  api.mockResolvedValue(
    respuesta({
      items: [
        {
          id: 'r1',
          nombre: 'Familia Prueba',
          leida_at: null,
          emails: [],
          contactos: [{ id: 'u1', email: 'familia@example.test' }],
        },
      ],
      resumen: {
        ...resumenBase,
        responsables: 1,
        responsables_no_leidos: 1,
        email_aplica: false,
      },
      total: 1,
      total_paginas: 1,
    }),
  )
  render(<EntregaComunicacion comunicacionId="c1" canal="portal" />)
  expect(await screen.findByText('Familia Prueba')).toBeInTheDocument()
  expect(screen.getByText('Esta comunicación no generó envíos por email.')).toBeInTheDocument()
  expect(tarjeta('Destinatarios')).toHaveTextContent('1')
  expect(tarjeta('Leídos')).toHaveTextContent('0')
  expect(tarjeta('Sin leer')).toHaveTextContent('1')
  expect(screen.queryByText('Enviados', { selector: 'p' })).not.toBeInTheDocument()
  expect(screen.queryByText('Rechazados', { selector: 'p' })).not.toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Email' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Estado' })).toBeInTheDocument()
  expect(screen.queryByRole('columnheader', { name: 'Estado mail' })).not.toBeInTheDocument()
  expect(screen.getByText('familia@example.test')).toBeInTheDocument()
  expect(screen.queryByText('Sin envío')).not.toBeInTheDocument()
  expect(screen.queryByText('Emails')).not.toBeInTheDocument()
  expect(screen.queryByRole('option', { name: 'Sin email' })).not.toBeInTheDocument()
})

it('recovers from an out-of-range page when the total shrinks', async () => {
  let pageTwoSeen = false
  let pageOneAfterTwo = false
  api.mockImplementation(async (path) => {
    const pagina = Number(new URL(path, 'http://localhost').searchParams.get('pagina') ?? '1')
    if (pagina === 2) {
      pageTwoSeen = true
      return respuesta({ items: [], total: 10, pagina: 2, total_paginas: 1 })
    }
    if (pageTwoSeen) pageOneAfterTwo = true
    return respuesta({
      items: [{ id: 'r1', nombre: 'Familia Prueba', leida_at: null, emails: [] }],
      total: pageTwoSeen ? 10 : 11,
      pagina: 1,
      total_paginas: pageTwoSeen ? 1 : 2,
    })
  })
  render(<EntregaComunicacion comunicacionId="c1" canal="ambos" />)
  expect(await screen.findByText('Familia Prueba')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('link', { name: '2' }))
  await waitFor(() => expect(pageTwoSeen).toBe(true))
  await waitFor(() => expect(pageOneAfterTwo).toBe(true))
  expect(await screen.findByText('Familia Prueba')).toBeInTheDocument()
  expect(screen.queryByText('No hay destinatarios para mostrar.')).not.toBeInTheDocument()
})

it('clears the retry error when the delivery is reloaded', async () => {
  api.mockImplementation(async (path) => {
    if (path.includes('/reintentar')) throw new Error('falló')
    return respuesta({
      items: [
        {
          id: 'r1',
          nombre: 'Familia Prueba',
          leida_at: null,
          emails: [{ id: 'e1', email: 'familia@example.test', estado: 'fallido', intentos: [] }],
        },
      ],
      resumen: {
        ...resumenBase,
        responsables: 1,
        responsables_con_email: 1,
        emails: 1,
        emails_fallidos: 1,
      },
      total: 1,
      total_paginas: 1,
    })
  })
  render(<EntregaComunicacion comunicacionId="c1" canal="ambos" />)
  expect(await screen.findByText('familia@example.test')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Reintentar envío a/ }))
  expect(await screen.findByText('No se pudo reintentar el envío.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Actualizar entrega' }))
  await waitFor(() =>
    expect(screen.queryByText('No se pudo reintentar el envío.')).not.toBeInTheDocument(),
  )
})
