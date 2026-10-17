import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { TareasPage } from '@/modules/workflows/pages/tareas-page'
import { cambiarEstadoTarea } from '@/modules/workflows/services/cambiar-estado-tarea'
import { listarTareas } from '@/modules/workflows/services/listar-tareas'
import { obtenerTarea } from '@/modules/workflows/services/obtener-tarea'
import type { Tarea, TareaDetalle, TareaListado } from '@/modules/workflows/types'
import { useAuthStore } from '@/store/auth-store'

vi.mock('@/modules/workflows/services/listar-tareas')
vi.mock('@/modules/workflows/services/obtener-tarea')
vi.mock('@/modules/workflows/services/cambiar-estado-tarea')
vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }))

const mockedListar = vi.mocked(listarTareas)
const mockedObtener = vi.mocked(obtenerTarea)
const mockedCambiar = vi.mocked(cambiarEstadoTarea)

const propia: Tarea = {
  id: 't-1',
  titulo: 'Llamar a la familia',
  descripcion: 'Reclamar la deuda',
  estado: 'pendiente',
  prioridad: 'alta',
  fecha_vencimiento: null,
  vencida: false,
  entidad: 'factura',
  entidad_id: 'f-1',
  usuario_id: 'u1',
  usuario_email: 'admin@esseri.edu.ar',
  workflow_execution_id: 'ej-1',
  workflow_rule_nombre: 'Tarea por mora',
  tarea_id: null,
  created_at: '2026-09-30T10:00:00',
  updated_at: '2026-09-30T10:00:00',
}
const ajena: Tarea = {
  ...propia,
  id: 't-2',
  titulo: 'Revisar el legajo',
  usuario_id: 'u2',
  usuario_email: 'secretaria@esseri.edu.ar',
}

function listado(items: Tarea[]): TareaListado {
  return { items, total: items.length, pagina: 1, tamanio_pagina: 20, total_paginas: 1 }
}

function detalleDe(tarea: Tarea, cadena: TareaDetalle['cadena'] = []): TareaDetalle {
  return { ...tarea, cadena }
}

function conPermisos(codigos: string[]) {
  const permisos = codigos.map((codigo, indice) => ({
    id: `p${indice}`,
    codigo,
    modulo: 'Workflows',
    accion: codigo.split('.')[1] ?? 'leer',
    tipo_informacion: null,
  }))
  useAuthStore.setState({
    usuario: {
      id: 'u1',
      email: 'admin@esseri.edu.ar',
      auth_provider: 'local',
      estado: 'activo',
      roles: ['admin'],
      permisos,
      perfiles: [{ id: 'admin', codigo: 'admin', nombre: 'admin', descripcion: null, permisos }],
      rol_activo: 'admin',
    },
    status: 'authenticated',
    rolActivo: 'admin',
  })
}

function renderPagina() {
  return render(
    <MemoryRouter>
      <TareasPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  conPermisos(['workflows.leer', 'workflows.actualizar'])
  mockedListar.mockResolvedValue(listado([propia, ajena]))
  mockedObtener.mockResolvedValue(detalleDe(propia))
})

describe('TareasPage', () => {
  it('con permiso de lectura muestra las tareas de todos y deja filtrar las propias', async () => {
    renderPagina()

    expect(await screen.findByText('Llamar a la familia')).toBeInTheDocument()
    expect(screen.getByText('Revisar el legajo')).toBeInTheDocument()
    expect(mockedListar.mock.lastCall?.[0]).toMatchObject({ soloMias: false })

    await userEvent.click(screen.getByRole('button', { name: /Asignación/ }))
    await userEvent.click(await screen.findByRole('radio', { name: 'Asignadas a mí' }))

    await waitFor(() => expect(mockedListar.mock.lastCall?.[0]).toMatchObject({ soloMias: true }))
  })

  it('sin permisos de Workflows no ofrece el filtro de asignación', async () => {
    conPermisos([])
    mockedListar.mockResolvedValue(listado([propia]))
    renderPagina()

    await screen.findByText('Llamar a la familia')

    expect(screen.queryByRole('button', { name: /Asignación/ })).not.toBeInTheDocument()
  })

  it('al cambiar un filtro vuelve a la página 1 y manda el filtro', async () => {
    mockedListar.mockResolvedValue({ ...listado([propia]), total: 60, total_paginas: 3 })
    renderPagina()
    await userEvent.click(await screen.findByText('2'))
    await waitFor(() => expect(mockedListar.mock.lastCall?.[0].pagina).toBe(2))

    await userEvent.click(screen.getByRole('button', { name: /Prioridad/ }))
    await userEvent.click(await screen.findByRole('radio', { name: 'Alta' }))

    await waitFor(() =>
      expect(mockedListar.mock.lastCall?.[0]).toMatchObject({ prioridad: 'alta', pagina: 1 }),
    )
  })

  it('sin tareas muestra el estado vacío según el alcance de la persona', async () => {
    mockedListar.mockResolvedValue(listado([]))
    renderPagina()
    expect(await screen.findByText('Todavía no hay tareas.')).toBeInTheDocument()

    conPermisos([])
    renderPagina()
    expect(await screen.findByText('No tenés tareas asignadas.')).toBeInTheDocument()
  })

  it('una persona sin permiso de actualizar solo puede avanzar sus propias tareas', async () => {
    conPermisos(['workflows.leer'])
    renderPagina()
    await screen.findByText('Revisar el legajo')

    // Cada tarea pendiente ofrece Iniciar y Completar: solo la propia (u1).
    expect(screen.getAllByRole('button', { name: /Iniciar/ })).toHaveLength(1)
  })

  it('avanza la tarea, avisa y vuelve a pedir el listado', async () => {
    mockedCambiar.mockResolvedValue(detalleDe({ ...propia, estado: 'en_progreso' }))
    renderPagina()
    await screen.findByText('Llamar a la familia')
    const pedidos = mockedListar.mock.calls.length

    await userEvent.click(screen.getAllByRole('button', { name: /Iniciar/ })[0])

    await waitFor(() => expect(mockedCambiar).toHaveBeenCalledWith('t-1', 'en_progreso'))
    expect(toast.success).toHaveBeenCalledWith('La tarea quedó en progreso.')
    await waitFor(() => expect(mockedListar.mock.calls.length).toBeGreaterThan(pedidos))
  })

  it('si el backend rechaza el cambio muestra su motivo', async () => {
    mockedCambiar.mockRejectedValue(
      new ApiError(409, "No se puede pasar una tarea 'completada' a 'en_progreso'."),
    )
    renderPagina()
    await screen.findByText('Llamar a la familia')

    await userEvent.click(screen.getAllByRole('button', { name: /Iniciar/ })[0])

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "No se puede pasar una tarea 'completada' a 'en_progreso'.",
      ),
    )
  })

  it('el detalle muestra el historial de escalamiento de la tarea', async () => {
    mockedObtener.mockResolvedValue(
      detalleDe(propia, [
        {
          id: 't-0',
          titulo: 'Llamar a la familia (original)',
          estado: 'escalada',
          prioridad: 'media',
          usuario_email: 'secretaria@esseri.edu.ar',
          tarea_id: null,
          created_at: '2026-09-29T10:00:00',
        },
        {
          id: 't-1',
          titulo: 'Escalada: Llamar a la familia',
          estado: 'pendiente',
          prioridad: 'alta',
          usuario_email: 'admin@esseri.edu.ar',
          tarea_id: 't-0',
          created_at: '2026-09-30T10:00:00',
        },
      ]),
    )
    renderPagina()
    await screen.findByText('Revisar el legajo')

    await userEvent.click(screen.getAllByRole('button', { name: /Ver detalle/ })[0])

    expect(await screen.findByText('Historial de escalamiento')).toBeInTheDocument()
    expect(await screen.findByText(/1\. Llamar a la familia \(original\)/)).toBeInTheDocument()
    expect(screen.getByText(/2\. Escalada: Llamar a la familia/)).toBeInTheDocument()
  })

  it('el detalle de una tarea que no se escaló lo aclara', async () => {
    renderPagina()
    await screen.findByText('Revisar el legajo')

    await userEvent.click(screen.getAllByRole('button', { name: /Ver detalle/ })[0])

    expect(await screen.findByText('Esta tarea no se escaló.')).toBeInTheDocument()
  })

  it('si falla el listado muestra el error y permite reintentar', async () => {
    mockedListar.mockRejectedValueOnce(new ApiError(500, 'Falló el servidor.'))
    renderPagina()

    expect(await screen.findByText('Falló el servidor.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Llamar a la familia')).toBeInTheDocument()
  })
})
