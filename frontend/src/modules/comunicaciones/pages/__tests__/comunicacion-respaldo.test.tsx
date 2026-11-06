import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import type { UsuarioActual } from '@/modules/auth/types'
import { useAuthStore } from '@/store/auth-store'
import {
  guardarRespaldo,
  leerRespaldos,
  type RespaldoBorrador,
} from '../../services/respaldo-borrador'
import { ComunicacionFormPage } from '../comunicacion-form-page'

vi.mock('@/api/client')

beforeEach(() => {
  const values = new Map<string, string>()
  const storage: Storage = {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  }
  vi.stubGlobal('localStorage', storage)
  useAuthStore.setState({ usuario: { id: 'user-a' } as UsuarioActual })
  vi.mocked(apiClient).mockResolvedValue({
    responsables: [],
    alumnos: [],
    niveles: [],
    divisiones: [],
    ciclos: [],
  })
})

it('backs up a partial subject immediately before any network debounce', async () => {
  render(
    <MemoryRouter>
      <ComunicacionFormPage />
    </MemoryRouter>,
  )
  await userEvent.type(screen.getByLabelText('Asunto'), 'Borrador')
  const drafts = leerRespaldos('user-a', false)
  expect(drafts).toHaveLength(1)
  expect(drafts[0].datos.asunto).toBe('Borrador')
  expect(drafts[0].datos.cuerpo).toBe('')
})

it('offers recovery of an unsynchronized draft when the form is opened again', async () => {
  const first = render(
    <MemoryRouter>
      <ComunicacionFormPage />
    </MemoryRouter>,
  )
  await userEvent.type(screen.getByLabelText('Asunto'), 'Recuperar esto')
  first.unmount()
  render(
    <MemoryRouter>
      <ComunicacionFormPage />
    </MemoryRouter>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Recuperar borrador: Recuperar esto' }))
  expect(screen.getByLabelText('Asunto')).toHaveValue('Recuperar esto')
})

it('offers to continue a synchronized draft from the new form', async () => {
  guardarRespaldo(
    'user-a',
    false,
    {
      clave: 'clave-local',
      asunto: 'Ya guardado',
      cuerpo: '',
      audiencia: { tipo: 'todos', ids: [] },
    },
    { localId: 'pestana-1', id: 'remoto-1', version: 3 },
  )
  render(
    <MemoryRouter>
      <ComunicacionFormPage />
    </MemoryRouter>,
  )
  expect(
    await screen.findByRole('link', { name: 'Continuar borrador: Ya guardado' }),
  ).toHaveAttribute('href', '/comunicaciones/remoto-1/editar')
})

const remoto = {
  id: 'c1',
  clave: 'clave-remota',
  asunto: 'Asunto del servidor',
  cuerpo: 'Contenido del servidor',
  tipo: 'institucional',
  estado: 'borrador',
  version: 4,
  audiencia: { tipo: 'todos', ids: [] },
  canal: 'portal',
  destinatarios: 0,
  autor_id: 'user-a',
  created_at: '2026-11-05T00:00:00',
  publicada_at: null,
  leida_at: null,
  adjuntos: [],
}

function editarBorrador() {
  vi.mocked(apiClient).mockImplementation(async (path) => {
    const ruta = String(path)
    if (ruta.includes('/opciones'))
      return { responsables: [], alumnos: [], niveles: [], divisiones: [], ciclos: ['2026'] }
    if (ruta.endsWith('/adjuntos')) return []
    if (ruta === '/comunicaciones/c1') return remoto
    return {}
  })
  return render(
    <MemoryRouter initialEntries={['/comunicaciones/c1/editar']}>
      <Routes>
        <Route path="/comunicaciones/:id/editar" element={<ComunicacionFormPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function copia(datos: Partial<RespaldoBorrador['datos']> = {}, pendiente?: boolean) {
  guardarRespaldo(
    'user-a',
    false,
    {
      clave: 'clave-remota',
      asunto: 'Asunto del servidor',
      cuerpo: 'Contenido del servidor',
      audiencia: { tipo: 'todos', ids: [] },
      ...datos,
    },
    { localId: 'pestana-1', id: 'c1', version: 1, pendiente },
  )
}

it('never lets a synchronized local cache hide newer server content', async () => {
  copia()
  editarBorrador()
  expect(await screen.findByLabelText('Mensaje')).toHaveValue('Contenido del servidor')
  expect(leerRespaldos('user-a', false)).toHaveLength(0)
})

it('still prefers a local copy with unsynchronized edits', async () => {
  copia({ cuerpo: 'Texto local sin sincronizar' }, true)
  editarBorrador()
  expect(await screen.findByLabelText('Mensaje')).toHaveValue('Texto local sin sincronizar')
})
