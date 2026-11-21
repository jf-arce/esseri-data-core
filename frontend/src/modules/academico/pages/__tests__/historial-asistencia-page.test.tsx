import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { useCicloLectivoStore } from '@/store/ciclo-lectivo-store'
import { HistorialAsistenciaPage } from '../historial-asistencia-page'
import { useConsultaHistorial } from '../../hooks/use-consulta-historial'
import { exportarHistorial, type FiltrosHistorial } from '../../services/consultar-historial'

const estado = vi.hoisted(() => ({
  vacio: false,
  exportar: true,
  error: null as string | null,
  puntos: [] as {
    fecha: string
    presentes: number
    ausentes: number
    porcentaje_presencia: number
  }[],
}))
vi.mock('../../hooks/use-consulta-historial', () => ({
  useCiclosHistorial: () => ({ datos: ['2026', '2025'], error: null, recargar: vi.fn() }),
  useConsultaHistorial: vi.fn((filtros: FiltrosHistorial) => ({
    datos: estado.error
      ? null
      : {
          items: estado.vacio
            ? []
            : [
                {
                  id: '1',
                  fecha: '2026-10-28',
                  tipo: 'presente',
                  alumno: 'Cabral, Tiziano',
                  division: 'B',
                  anio: 4,
                  nivel: 'Primario',
                },
              ],
          total: estado.vacio ? 0 : 21,
          pagina: filtros.pagina ?? 1,
          tamanio_pagina: 20,
          total_paginas: estado.vacio ? 0 : 2,
          resumen: {
            total_registros: estado.vacio ? 0 : 21,
            presentes: 10,
            ausentes_justificadas: 5,
            ausentes_injustificadas: 4,
            porcentaje_presencia: 57.14,
          },
        },
    cargando: false,
    error: estado.error,
    sinPermiso: false,
    recargar: vi.fn(),
  })),
  useOpcionesHistorial: () => ({
    datos: [
      {
        inscripcion_id: 'inscripcion-1',
        alumno: 'Cabral, Tiziano',
        division_id: 'division-1',
        division: '4°B',
        anio_id: 'anio-1',
        anio: 4,
        nivel_educativo_id: 'nivel-1',
        nivel: 'Primario',
      },
      {
        inscripcion_id: 'inscripcion-2',
        alumno: 'Otro alumno',
        division_id: 'division-2',
        division: '1°A',
        anio_id: 'anio-2',
        anio: 1,
        nivel_educativo_id: 'nivel-2',
        nivel: 'Secundario',
      },
    ],
    cargando: false,
    error: null,
    recargar: vi.fn(),
  }),
  useTendenciaHistorial: () => ({
    datos: { puntos: estado.puntos },
    cargando: false,
    error: null,
    sinPermiso: false,
    recargar: vi.fn(),
  }),
}))
vi.mock('../../services/consultar-historial', () => ({
  exportarHistorial: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/store/auth-store', () => ({
  permisosActivos: vi.fn(),
  useAuthStore: () => (estado.exportar ? [{ codigo: 'academico.exportar' }] : []),
}))

beforeEach(() => {
  vi.clearAllMocks()
  estado.vacio = false
  estado.exportar = true
  estado.error = null
  estado.puntos = []
  useCicloLectivoStore.setState({ cicloLectivo: '2026' })
})
const originales = new Map<string, PropertyDescriptor | undefined>()
beforeAll(() => {
  for (const nombre of [
    'hasPointerCapture',
    'setPointerCapture',
    'releasePointerCapture',
    'scrollIntoView',
  ]) {
    if (Object.getOwnPropertyDescriptor(HTMLElement.prototype, nombre)) continue
    originales.set(nombre, Object.getOwnPropertyDescriptor(HTMLElement.prototype, nombre))
    Object.defineProperty(HTMLElement.prototype, nombre, {
      configurable: true,
      value: vi.fn(() => false),
    })
  }
})
afterAll(() => {
  for (const [nombre, descriptor] of originales) {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, nombre, descriptor)
    else Reflect.deleteProperty(HTMLElement.prototype, nombre)
  }
})
afterEach(() => {
  vi.useRealTimers()
  window.history.replaceState({}, '', '/')
})

async function elegir(nombre: string, opcion: string) {
  await userEvent.click(screen.getByRole('combobox', { name: nombre }))
  await userEvent.click(screen.getByRole('option', { name: opcion }))
}

it('opens the global cycle without a date filter and shows full-result indicators and result counts', () => {
  render(<HistorialAsistenciaPage />)
  expect(useConsultaHistorial).toHaveBeenLastCalledWith(
    expect.objectContaining({
      ciclo_lectivo: '2026',
      orden: 'fecha_desc',
    }),
  )
  const filtrosIniciales = vi.mocked(useConsultaHistorial).mock.lastCall?.[0]
  expect(filtrosIniciales?.fecha_desde).toBeUndefined()
  expect(filtrosIniciales?.fecha_hasta).toBeUndefined()
  const indicadores = screen.getByRole('region', { name: 'Indicadores de asistencia' })
  expect(within(indicadores).getByText('Total de registros')).toBeInTheDocument()
  expect(within(indicadores).getByText('21')).toBeInTheDocument()
  expect(within(indicadores).getByText('57,14%')).toBeInTheDocument()
  expect(screen.getByText('1-20 de 21 registros')).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Nivel' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Curso' })).toBeInTheDocument()
  expect(screen.queryByRole('columnheader', { name: 'División' })).not.toBeInTheDocument()
  // El curso concatena el año con la división: "4" + "B" → "4°B".
  expect(screen.getByText('Primario')).toBeInTheDocument()
  expect(screen.getByText('4°B')).toBeInTheDocument()
})

it('opens the day named by a ?fecha= deep link without changing the other filters', () => {
  window.history.replaceState({}, '', '/academico/historial-asistencia?fecha=2026-05-04')
  render(<HistorialAsistenciaPage />)
  expect(useConsultaHistorial).toHaveBeenLastCalledWith(
    expect.objectContaining({
      ciclo_lectivo: '2026',
      fecha_desde: '2026-05-04',
      fecha_hasta: '2026-05-04',
      orden: 'fecha_desc',
    }),
  )
})

it('muestra el detalle de cada barra de la tendencia al enfocarla', async () => {
  estado.puntos = [
    { fecha: '2026-11-17', presentes: 20, ausentes: 5, porcentaje_presencia: 80 },
    { fecha: '2026-11-18', presentes: 18, ausentes: 7, porcentaje_presencia: 72 },
  ]
  render(<HistorialAsistenciaPage />)

  const barras = await screen.findAllByRole('button', { name: /Ver tendencia del/ })
  expect(barras).toHaveLength(2)
  await userEvent.hover(barras[0])

  expect(await screen.findByText('80% de presencia')).toBeInTheDocument()
  expect(screen.getByText('20 presentes · 5 ausentes')).toBeInTheDocument()
})

it('applies independent selectors, state and date filters without cascading resets', async () => {
  render(<HistorialAsistenciaPage />)
  await elegir('Nivel educativo', 'Primario')
  await elegir('Año', '4° año · Primario')
  await elegir('División', '4°B · Primario')
  await elegir('Alumno', 'Cabral, Tiziano')
  await elegir('Estado de asistencia', 'Ausente justificado')
  fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-03-01' } })
  fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-03-31' } })
  expect(useConsultaHistorial).toHaveBeenLastCalledWith(
    expect.objectContaining({
      nivel_educativo_id: 'nivel-1',
      anio_id: 'anio-1',
      division_id: 'division-1',
      inscripcion_id: 'inscripcion-1',
      estado: 'ausente_justificado',
      fecha_desde: '2026-03-01',
      fecha_hasta: '2026-03-31',
    }),
  )
  // Cambiar de nivel no borra el año/división/alumno ya elegidos: los filtros son independientes.
  await elegir('Nivel educativo', 'Secundario')
  expect(useConsultaHistorial).toHaveBeenLastCalledWith(
    expect.objectContaining({
      nivel_educativo_id: 'nivel-2',
      anio_id: 'anio-1',
      division_id: 'division-1',
      inscripcion_id: 'inscripcion-1',
      pagina: 1,
    }),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
  expect(useConsultaHistorial).toHaveBeenLastCalledWith(
    expect.objectContaining({
      ciclo_lectivo: '2026',
      orden: 'fecha_desc',
      pagina: 1,
    }),
  )
  expect(vi.mocked(useConsultaHistorial).mock.lastCall?.[0].estado).toBeUndefined()
})

it('follows global cycle changes and clears enrollment filters from another cycle', async () => {
  render(<HistorialAsistenciaPage />)
  await elegir('División', '4°B · Primario')
  await elegir('Alumno', 'Cabral, Tiziano')
  act(() => useCicloLectivoStore.setState({ cicloLectivo: '2025' }))
  expect(useConsultaHistorial).toHaveBeenLastCalledWith(
    expect.objectContaining({ ciclo_lectivo: '2025', pagina: 1 }),
  )
  expect(vi.mocked(useConsultaHistorial).mock.lastCall?.[0].inscripcion_id).toBeUndefined()
  act(() => useCicloLectivoStore.setState({ cicloLectivo: '2026' }))
  expect(vi.mocked(useConsultaHistorial).mock.lastCall?.[0].inscripcion_id).toBeUndefined()
})

it('paginates and resets pagination when date or student sorting changes', async () => {
  render(<HistorialAsistenciaPage />)
  await userEvent.click(screen.getByRole('link', { name: 'Ir a la página siguiente' }))
  expect(useConsultaHistorial).toHaveBeenLastCalledWith(expect.objectContaining({ pagina: 2 }))
  await userEvent.click(screen.getByRole('button', { name: 'Alumno' }))
  expect(useConsultaHistorial).toHaveBeenLastCalledWith(
    expect.objectContaining({ pagina: 1, orden: 'alumno_asc' }),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Alumno' }))
  expect(useConsultaHistorial).toHaveBeenLastCalledWith(
    expect.objectContaining({ orden: 'alumno_desc' }),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Fecha' }))
  expect(useConsultaHistorial).toHaveBeenLastCalledWith(
    expect.objectContaining({ orden: 'fecha_asc' }),
  )
})

it('exports active filters and hides export for roles without export permission', async () => {
  const { unmount } = render(<HistorialAsistenciaPage />)
  await elegir('Estado de asistencia', 'Presente')
  await userEvent.click(screen.getByRole('button', { name: 'Exportar' }))
  expect(screen.getAllByRole('menuitem')).toHaveLength(3)
  await userEvent.click(screen.getByRole('menuitem', { name: 'CSV' }))
  expect(exportarHistorial).toHaveBeenLastCalledWith(
    expect.objectContaining({ estado: 'presente', ciclo_lectivo: '2026' }),
    'csv',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Exportar' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Excel' }))
  expect(exportarHistorial).toHaveBeenLastCalledWith(expect.anything(), 'xlsx')
  await userEvent.click(screen.getByRole('button', { name: 'Exportar' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'PDF' }))
  expect(exportarHistorial).toHaveBeenLastCalledWith(
    expect.objectContaining({ estado: 'presente', ciclo_lectivo: '2026' }),
    'pdf',
  )
  unmount()
  estado.exportar = false
  render(<HistorialAsistenciaPage />)
  expect(screen.queryByRole('button', { name: 'Exportar' })).not.toBeInTheDocument()
})

it('shows a useful empty state and does not represent a failed request as zero', () => {
  estado.vacio = true
  const { unmount } = render(<HistorialAsistenciaPage />)
  expect(screen.getByText('No hay asistencias con estos filtros.')).toBeInTheDocument()
  unmount()
  estado.error = 'No se pudo consultar'
  render(<HistorialAsistenciaPage />)
  expect(screen.getAllByText('No disponible')).toHaveLength(5)
  expect(screen.getByRole('alert')).toHaveTextContent('No se pudo consultar')
})
